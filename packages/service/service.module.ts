import { Module, DynamicModule, Global } from '@nestjs/common';
import * as Consul from 'consul';
import { ConsulService } from './consul-service';
import {
    NEST_BOOT_PROVIDER,
    NEST_CONSUL_PROVIDER,
    NEST_SERVICE_PROVIDER,
    NEST_BOOT,
    IBoot,
    NEST_ETCD,
    NEST_ETCD_PROVIDER,
    NEST_CONSUL,
    IServiceNode,
} from '@nestcloud/common';
import { IServiceOptions } from './interfaces/service-options.interface';
import { EtcdService } from './etcd-service';
import { ZKService } from './zk-service';

const NEST_ZK = 'NEST_ZK';
const NEST_ZK_PROVIDER = 'NEST_ZK_PROVIDER';
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

@Global()
@Module({})
export class ServiceModule {
    static register(options: IServiceOptions = {}): DynamicModule {
        const inject = [];
        if (options.dependencies) {
            if (options.dependencies.includes(NEST_BOOT)) {
                inject.push(NEST_BOOT_PROVIDER);
            }
            if (options.dependencies.includes(NEST_CONSUL)) {
                inject.push(NEST_CONSUL_PROVIDER);
            }
            if (options.dependencies.includes(NEST_ETCD)) {
                inject.push(NEST_ETCD_PROVIDER);
            }
            if (options.dependencies.includes(NEST_ZK)) {
                inject.push(NEST_ZK_PROVIDER);
            }
        }

        const consulServiceProvider = {
            provide: NEST_SERVICE_PROVIDER,
            useFactory: async (...args: any[]): Promise<ConsulService> => {
                const boot: IBoot = args[inject.indexOf(NEST_BOOT_PROVIDER)];
                const consul: Consul = args[inject.indexOf(NEST_CONSUL_PROVIDER)];
                const etcd: Consul = args[inject.indexOf(NEST_ETCD_PROVIDER)];
                const zk: ZK = args[inject.indexOf(NEST_ZK_PROVIDER)];
                if (boot) {
                    options = boot.get<IServiceOptions>('service', {});
                }
                let service;
                if (consul) {
                    service = new ConsulService(consul, options);
                } else if (etcd) {
                    service = new EtcdService(etcd, options);
                } else if (zk){
                    service = new ZKService(zk, options);
                } else {
                    throw new Error('Please specific NEST_CONSUL or NEST_ETCD in dependencies attribute');
                }

                await service.init();
                return service;
            },
            inject,
        };

        return {
            module: ServiceModule,
            providers: [consulServiceProvider],
            exports: [consulServiceProvider],
        };
    }
}
