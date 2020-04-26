import { OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { IService, IServiceNode} from '@nestcloud/common';
import { getIPAddress } from './utils/os.util';
import { get } from 'lodash';
import { IServiceOptions } from './interfaces/service-options.interface';
import { ServiceNode } from './service-node';
interface ZK {
    root: string;
    init(): void;
    get(path: string): Promise<IServiceNode []>;
    close(): void;
    save(path: string, data: string): Promise<any>;
    getServices(): Promise<string[]>;
    subscribe(callback: (e: any, ch: string[]) => void, path ?: string): void;
    getData(key: string): Promise<IServiceNode>;
}
export class ZKService implements IService, OnModuleInit, OnModuleDestroy {

    private readonly logger = new Logger('ServiceModule');

    private readonly discoveryHost: string;
    private readonly serviceName: string;
    private readonly servicePort: number;
    private readonly services: { [service: string]: IServiceNode[] } = {};

    private readonly serviceCallbackMaps: Map<string, ((nodes: IServiceNode[]) => void)[]> = new Map();
    private readonly servicesCallbacks: ((services: string[]) => void)[] = [];

    constructor(private readonly zk: ZK, private readonly options: IServiceOptions, ){
        this.discoveryHost = get(options, 'discoveryHost', getIPAddress());
        this.serviceName = get(options, 'name');

        // tslint:disable-next-line:no-bitwise
        this.servicePort = get(options, 'port', 40000 + ~~(Math.random() * (40000 - 30000)));

    }
    async init() {
        const serviceNames = await this._getServiceNames();
        await this.initServices(serviceNames);
        this.createServicesWatcher();
    }

    private setNodes(service: string, nodes: IServiceNode[]) {
        this.services[service] = nodes;
        if (this.serviceCallbackMaps.has(service)) {
            const callbacks = this.serviceCallbackMaps.get(service);
            callbacks.forEach(cb => cb(nodes));
        }
    }

    async initServices(serviceNames: string[]) {

        await Promise.all(serviceNames.map(async (service) => {
            const nodes = await this.zk.get(service);

            this.setNodes(service, nodes);
            this.createServiceNodesWatcher(service);
        }));
    }

    public async _getServiceNames(): Promise<string[]> {
        return  this.zk.getServices();
    }
    public getServiceNames(): string[]{
        const services: string[] = [];
        for (const key in this.services) {
            if (this.services.hasOwnProperty(key)) {
                services.push(key);
            }
        }
        return services;
    }

    public getServiceNodes(service: string, passing?: boolean): IServiceNode[] {
        return this.services[service];
    }

    public getServices(): { [p: string]: IServiceNode[] } {
        return this.services;
    }

    watch(service: string, callback: (services: IServiceNode[]) => void) {
        const callbacks = this.serviceCallbackMaps.get(service);
        if (!callbacks) {
            this.serviceCallbackMaps.set(service, [callback]);
        } else {
            callbacks.push(callback);
            this.serviceCallbackMaps.set(service, callbacks);
        }
    }

    watchServiceList(callback: (service: string[]) => void) {
        this.servicesCallbacks.push(callback);
    }

    async onModuleInit(): Promise<any> {
        await this.registerService();
    }

    async onModuleDestroy(){
        await this.zk.close();
    }

    async registerService(){
        const serviceNode = new ServiceNode(this.discoveryHost, this.servicePort + '');
        serviceNode.tags = this.options.tags || [];
        if (this.options.name) {
            serviceNode.name = this.options.name;
        }

        await this.zk.save(this.serviceName, JSON.stringify(serviceNode));
    }

    private createServicesWatcher() {
        this.zk.subscribe(async (e: any, ch: string[]) => {
            if (e){
                this.logger.error(e);
                return;
            }
            await this.initServices(ch);
            this.servicesCallbacks.forEach(cb => cb(ch));
        });
    }

    private createServiceNodesWatcher(service: string) {
        this.zk.subscribe(async (e: any, ch: string[]) => {
            if (e){
                this.logger.error(e);
                return;
            }

            const nodes = await Promise.all(ch.map(async (item) => {
                // 拼接路径
                const path = `${this.zk.root}/${service}/${item}`;
                const node = await this.zk.getData(path);
                return node;
            }));

            this.setNodes(service, nodes);

        }, service);
    }

}