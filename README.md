# File File System

File File System works similarly to the fs module but everything is saved inside a file on the disk

Currently it supports:

- Creating/Loading multiple file systems
- Basic file actions (create, delete, read, write, append, rename, copy)
- Base file queries (exists, stat)
- Basic directory actions (list)
- Fetching file system info

## Setup

To setup simply type `npm install file-file-system --save` in a console

Then in your script add `const { FileFileSystem } = require("file-file-system")`

## Creating a file file system

To create a file system you just need to instantiate a FileFileSystem object. `const fileSystem = FileFileSystem.createIfNotExist(fileName)`\
You may also use `FileFileSystem.create(fileName)` and `FileFileSystem.load(fileName)` but you must check if the filesystem exists or not first.

## Methods

Get disk meta - `var meta = fileSystem.diskMeta()`\
Save to disk - `fileSystem.save()`\
Reload from disk - `fileSystem.reload()`

Check if file exists - `var exists = fileSystem.exists(file)`\
Get file info - `var stat = fileSystem.statFile(file)`

Create file - `fileSystem.createFile(file)`\
Delete file - `fileSystem.deleteFile(file)`

Read from file - `var content = fileSystem.readFile(file)`\
Read directory contents - `var files = fileSystem.readDir(dir)`\
Write to file - `fileSystem.writeFile(file, content)`\
Append to file - `fileSystem.appendFile(file, content)`

Rename/Move file - `fileSystem.rename(file, newFile)`\
Copy file - `fileSystem.copy(source, dest)`

## Open Options

`autoSave` - Wether or not to automatically save the file to disk for you whenever you modify a file - Default true

## Options

`format` - The file system format (Normal, Flat) - Default normal\
`fileSize` - The size the file is allowed to take up on the real disk (In kilobytes) - Default 64000 (64mb)
