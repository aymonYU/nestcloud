import { get, set } from 'lodash';
import { Module, DynamicModule, Global } from '@nestjs/common';
import { NEST_BOOT_PROVIDER, NEST_BOOT } from '@nestcloud/common';
import { Boot } from '@nestcloud/boot';
import { ZK } from './zk';
const NEST_ZK_PROVIDER = 'NEST_ZK_PROVIDER';

export interface IZKOptions {
    dependencies?: string[];
    connect?: string;
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
                if (options.dependencies && options.dependencies.includes(NEST_BOOT)) {
                    options = boot.get('zk', {connect: '127.0.0.1:58002'});
                }

                return new ZK(options);
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
