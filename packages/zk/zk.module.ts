import { get, set } from 'lodash';
import { Module, DynamicModule, Global } from '@nestjs/common';
import { NEST_BOOT_PROVIDER, NEST_BOOT } from '@nestcloud/common';
import { Boot } from '@nestcloud/boot';
import { ZK } from './zk';
const NEST_ZK_PROVIDER = 'NEST_ZK_PROVIDER';

export interface IZKOptions {
    dependencies?: string[];
    /**
     * zk 服务器 host
     * 支持给定一个 字符串 或者 一个异步方法
     */
    connect?: (() => Promise<string>) | string;
    /**
     * zk 连接超时时间
     */
    timeout?: number;
}
@Global()
@Module({})
export class ZKModule {
    static register(options: IZKOptions): DynamicModule {
        const inject = [];
        if (options.dependencies && options.dependencies.includes(NEST_BOOT)) {
            inject.push(NEST_BOOT_PROVIDER);
        }
        const zkProvider = {
            provide: NEST_ZK_PROVIDER,
            useFactory: async (boot: Boot): Promise<ZK> => {
                // 第一步: 用代码调用层面去获取配置
                let zkOpt = {
                    connect: '',
                    timeout: options.timeout,
                };
                if (typeof options.connect === 'string') {
                    zkOpt.connect = options.connect;
                } else if (typeof options.connect === 'function') {
                    zkOpt.connect = await options.connect();
                }

                // 第二步: 尝试去读取 yaml 文件
                // 如果第一步第二步有同样的配置项, 则 yaml 的配置优先级更高
                if (options.dependencies && options.dependencies.includes(NEST_BOOT)) {
                    // 这里不能给 connect 一个默认值, 否则第一步的内容就无效了
                    const yamlOpt = boot.get('zk');

                    zkOpt = Object.assign(zkOpt, yamlOpt);
                }

                // 如果到这来还没有 zk 有效设定, 则报错
                if (!zkOpt.connect) {
                    throw new Error('invaliad connect for zk');
                }

                return new ZK(zkOpt);
            },
            inject,
        };

        return {
            module: ZKModule,
            providers: [zkProvider],
            exports: [zkProvider],
        };
    }
}
