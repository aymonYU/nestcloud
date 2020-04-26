import { Client , CreateMode, createClient , Exception, Event} from 'node-zookeeper-client';
import { v4 as uid } from 'uuid';

export class ZK {
    root: string = '';
    connected: boolean = false;
    zk: Client;
    constructor({
        root = '/',
        connect,
        timeout = 2000,
    }: {
        root?: string;
        connect?: string;
        timeout?: number;
    }){
        this.root = root;

        this.zk = createClient(connect, { sessionTimeout: timeout });
        this.zk.once('connected', () => {
            this.connected = true;
        });

        setTimeout(() => {
            if (!this.connected) {
                throw new Error('zookeeper connect timeout');
            }
        }, timeout);

        this.zk.connect();

    }

    /**
     * 添加
     * @param path
     * @param data
     */
    save(path: string, data: string) {
        // PERSISTENT for service *
        const folder = `${this.root}/${path}`;
        const keyStr = uid();
        return this._createNode(folder, '', CreateMode.PERSISTENT)
            .then(() => {
                return this.del(`${folder}/${keyStr}`);
            })
            .then(() => {
                // create `Ephemeral Node` for each providers
                return this._createNode(`${folder}/${keyStr}`, data, CreateMode.EPHEMERAL);
            });
    }

    /**
     * 根据uid更新某个value
     * @param path
     * @param id
     * @param data
     */
    update(path: string, id: string, data: string) {
        return this._createNode(`${this.root}/${path}/${id}`, data, CreateMode.EPHEMERAL);
    }

    close(){
        this.zk.close();
    }

    async get(path: string) {
        const keys = await this.getListKeys(path);
        const result = await this.getListValues(keys);
        return result;
    }

    _createNode(path: string, data: string, mode: number) {
        return new Promise((resolve, reject) => {
            this.zk.create(path, Buffer.from(data), mode, (error: any, nodePath) => {
                if (error) {
                    if (
                        error.getCode() === Exception.NODE_EXISTS ||
                        error.getCode() === Exception.OK
                    ) {
                        resolve('Create or Exist path: ' + (nodePath || this.root));
                    } else {
                        // other error
                        return reject(error);
                    }
                }

                return resolve(true);
            });
        });
    }

    subscribe( callback: (e: any, ch: string[]) => void, path ?: string) {
        const _path = path ? `${this.root}/${path}` : this.root;
        const watcher = (event: any) => {
            if (event.getType() === Event.NODE_CHILDREN_CHANGED) {
                this.zk.getChildren(_path, watcher, (error: any, children) => {
                    if (children.length === 0) {
                        return;
                    }
                    if (error) {
                        callback(error, []);
                    } else {
                        callback(null, children);
                    }
                });
            }
        };
        // tslint:disable-next-line:no-empty
        this.zk.getChildren(_path, watcher, () => {});
    }

    getListKeys(path: string): Promise<string[]> {
        return new Promise((resolve, reject) => {
            this.zk.getChildren(`${this.root}/${path}`, (error, children) => {
                if (error) {
                    return reject(error);
                }
                const chs = children.map(child => {
                    return `${this.root}/${path}/${child}`;
                });
                return resolve(chs);
            });
        });
    }

    getServices(){
        return new Promise((resolve, reject) => {
            this.zk.getChildren(`${this.root}`, (error, children) => {
                if (error) {
                    return reject(error);
                }
                return resolve(children);
            });
        })as Promise<string[]>;
    }

    getListValues(keys: string[]): Promise < Array < { [key: string]: string; } >> {
        return Promise.all(
            keys.map((key: string) => {
                return new Promise((resolve, reject) => {
                    this.zk.getData(key, (error, data, stat) => {
                        if (error) {
                            return reject(error);
                        }
                        const jsonStr = data ? data.toString() : '{}';
                        try {
                            const json = JSON.parse(jsonStr);
                            return resolve(json);
                        } catch (e) {
                            // tslint:disable-next-line:no-console
                            console.log('value is not json string');
                            return reject(e);
                        }
                    });
                }) as Promise<{ [key: string]: string }>;
            }),
        );
    }
    getData(key: string){
        return new Promise((resolve, reject) => {
            this.zk.getData(key, (error, data, stat) => {
                if (error) {
                    return reject(error);
                }
                const jsonStr = data ? data.toString() : '{}';
                try {
                    const json = JSON.parse(jsonStr);
                    return resolve(json);
                } catch (e) {
                    // tslint:disable-next-line:no-console
                    console.log('value is not json string');
                    return reject(e);
                }
            });
        });
    }

    del(path: string) {
        return new Promise(resolve => {
            this.zk.remove(path, () => {
                return resolve(true);
            });
        });
    }
}
