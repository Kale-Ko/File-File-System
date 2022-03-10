# File File System

File File System works similarly to the fs module but everthing is saved inside a file on the disk

Currently it supports:

- Basic file actions (exists, stat, create, delete, read, write, append, rename, copy)
- Basic dirrectory actions (list)

## Setup

To setup simply type `npm install file-file-system --save` in a console

Then in your script add `const { FileFileSystem } = require("file-file-system")`

## Creating a file file system

To create a file system you just need to instantiate a FileFileSystem object. `const fileSystem = new FileFileSystem(fileName)`

## Reading files

To read from a file you can just call `fileSystem.readFile(file)`

## Writing files

Writing files is also simple, `fileSystem.writeFile(file, data)`
