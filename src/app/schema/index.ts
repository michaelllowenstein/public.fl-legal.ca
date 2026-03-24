import * as Constant from '@schema/constants';
import * as Model from '@schema/models';
import * as Utils from '@schema/utils';

export type Schema = {
    Constant: typeof Constant;
    Model: typeof Model;
    Utils: typeof Utils;
}

export const Schema: Schema = {
    Constant,
    Model,
    Utils,
}