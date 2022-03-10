# File File System

File File System works similarly to the fs module but everthing is saved inside a file on the disk

Currently it supports:

- Creating/Loading multiple file systems
- Basic file actions (create, delete, read, write, append, rename, copy)
- Base file queries (exists, stat)
- Basic dirrectory actions (list)
- Fetching file system info

## Setup

To setup simply type `npm install file-file-system --save` in a console

Then in your script add `const { FileFileSystem } = require("file-file-system")`

## Creating a file file system

To create a file system you just need to instantiate a FileFileSystem object. `const fileSystem = FileFileSystem.createIfNotExist(fileName, openOptions (optional), options (optional))`\
You may also use `FileFileSystem.create(fileName, openOptions (optional), options (optional))` and `FileFileSystem.load(fileName, openOptions (optional))` but you must check if the filesystem exists or not first.

## Open Options

`autoSave` - Wether or not to automatically save the file to disk for you whenever you modify a file

## Options

`maxFileSize` - The maximum size the file is allowed to take up on the real disk
`flat` - Weather to allow dirrectories or not

## Methods

Get disk meta - `var meta = fileSystem.diskMeta()`\
Save to disk - `fileSystem.save()`\
Reload from disk - `fileSystem.reload()`

Check if file exists - `var exists = fileSystem.exists(file)`
Get file info - `var stat = fileSystem.statFile(file)`

Create file - `fileSystem.createFile(file)`\
delete file - `fileSystem.deleteFile(file)`

Read from file - `var content = fileSystem.readFile(file)`\
Read dirrectory contents - `var files = fileSystem.readDir(dir)`
Write to file - `fileSystem.writeFile(file, content)`\
Append to file - `fileSystem.appendFile(file, content)`

Rename/Move file - `fileSystem.rename(file, newname)`\
Copy file - `fileSystem.rename(source, dest)`
