// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

export type Credentials = {
    account: string;
    password?: string;
};

export type ServiceCredentials = {
    service: string;
} & Credentials;

export type ServiceAccount = {
    service: string;
    account: string;
};

/**
 * Password store for user credentials.
 *
 * @export
 * @interface IPasswordStore
 */
export interface IPasswordStore {
    get(service: string, account: string): Promise<string>;
    /**
     * Saves the password for the given account.
     * If a password already exists for this account it will be replaced.
     * @param {string} service
     * @param {string} account
     * @param {string} password
     * @returns {Promise<void>}
     * @memberof IPasswordStore
     */
    update(service: string, account: string, password: string): Promise<void>;
    remove(service: string, account: string): Promise<void>;
}

/**
 * Keeps track of all used Account names for a given host and service.
 * @export
 * @interface IAccountHistoryStore
 */
export interface IAccountHistoryStore {
    /**
     * Gets a list of all accounts associated with a given host + service.
     * With last used items added to the top of the list.
     * @param {string} host
     * @param {string} service
     * @param {string} account
     * @returns {Promise<string[]>}
     * @memberof IAccountHistoryStore
     */
    getAccounts(host: string, service: string, account: string): Promise<string[]>;
    /**
     * Adds an acccount to the list of previously used accounts against a host + service.
     * If it already exists, then its added to the top of the list of accounts.
     * @param {string} host
     * @param {string} service
     * @param {string} account
     * @returns {Promise<void>}
     * @memberof IAccountHistoryStore
     */
    add(host: string, service: string, account: string): Promise<void>;
    /**
     * Removes all accounts associated with a given host and optionall a service.
     * @param {string} host
     * @param {string} service
     * @returns {Promise<void>}
     * @memberof IAccountHistoryStore
     */
    remove(host: string, service?: string): Promise<void>;
}
