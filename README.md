# cbs-client

A node.js client for testing the functionality of [challenge-bypass-server](https://github.com/privacypass/challenge-bypass-server) using the scripts from [challenge-bypass-extension](https://github.com/privacypass/challenge-bypass-extension).

Currently I've had to take the methods that are required by hand from the extension. I know this is terrible practice and it also requires that this is kept manually up-to-date with the current version of the extension. For now, however it works and is able to showcase compatibility with the server.

## Quickstart

- Run an instance of the challenge-bypass-server

    ```
    make all

    .GOPATH/bin/challenge-bypass-server -key testdata/p256-key.pem -comm testdata/test-p256-commitment
    ```

- Run index.js

    ```
    node index.js <number-of-tokens> <opt-flags>
    ```

- e.g. to run with 30 tokens and with redemption 'on', execute:

    ```
    node index.js 30 redeem
    ```
