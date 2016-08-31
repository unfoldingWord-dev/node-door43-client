# node-door43-client
A client library for interacting with the [Door43](https://door43.org) Resource Catalog (eventually to be located at https://cdn.door43.org/v3/catalog.json).

> This library is still under development

## Installation
```
npm install door43-client
```

## CLI
To use the cli commands you must install globally

```
npm install -g door43-client
```

Then you can generate an index and download resource containers.
```
door43-client index
...
door43-client download
```

For details on additional arguments append `-h` to the command