const fs = require("fs")

class NullError extends Error { public constructor(element: string) { super("NullError: " + element + " can not be null") } }
class ParamError extends Error { public constructor(element: string, reason: string) { super("ParamError: " + element + " " + reason) } }
class FilePathError extends Error { public constructor(path: string, reason?: string) { super("FilePathError: " + path + " is not a valid path" + (reason != null ? ": " + reason : "")) } }
class MalformedFileError extends Error { public constructor(reason: string) { super("Invalid or corrupt file: " + reason) } }
class FileNotExistsError extends Error { public constructor(file: string) { super("File " + file + " does not exist") } }
class FileAlreadyExistsError extends Error { public constructor(file: string) { super("File " + file + " already exists") } }
class InvalidFilePathError extends Error { public constructor(file: string) { super("Path " + file + " is not valid/allowed") } }
class InvalidDataError extends Error { public constructor() { super("That data is not valid/allowed") } }

const VERSION = 2

class FileFileSystemOpenOptions {
    public autoSave: boolean = true
}

enum FileFileSystemFormat {
    NORMAL = 0,
    FLAT = 1,
}

class FileFileSystemOptions {
    public format: FileFileSystemFormat = FileFileSystemFormat.NORMAL
    public maxFileSize: number = 64000
}

class FileFileSystem {
    private _file: string
    public get file() { return this._file }

    private data: FileFileData = FileFileData.EMPTY

    public autoSave: boolean

    private constructor(file: string, { autoSave = new FileFileSystemOpenOptions().autoSave }: FileFileSystemOpenOptions = new FileFileSystemOpenOptions()) {
        if (file == null) {
            throw new NullError("file")
        }

        if (!file.endsWith(".ffs")) {
            throw new FilePathError(file, "File must end in .ffs")
        }

        this._file = file

        if (autoSave == null) {
            throw new NullError("autoSave")
        }

        this.autoSave = autoSave
    }

    public static createIfNotExist(file: string, { autoSave = new FileFileSystemOpenOptions().autoSave }: FileFileSystemOpenOptions = new FileFileSystemOpenOptions(), { format = new FileFileSystemOptions().format, maxFileSize = new FileFileSystemOptions().maxFileSize }: FileFileSystemOptions = new FileFileSystemOptions()) {
        if (file == null) {
            throw new NullError("file")
        }

        if (!file.endsWith(".ffs")) {
            throw new FilePathError(file, "File must end in .ffs")
        }

        if (!fs.existsSync(file)) {
            return FileFileSystem.create(file, { autoSave }, { format, maxFileSize })
        } else {
            return FileFileSystem.load(file, { autoSave })
        }
    }

    public static load(file: string, { autoSave = new FileFileSystemOpenOptions().autoSave }: FileFileSystemOpenOptions = new FileFileSystemOpenOptions()) {
        var fileSystem = new FileFileSystem(file, { autoSave })

        if (fs.existsSync(file)) {
            fileSystem.reload()
        } else {
            throw new FileNotExistsError(file)
        }

        return fileSystem
    }

    public static create(file: string, { autoSave = new FileFileSystemOpenOptions().autoSave }: FileFileSystemOpenOptions = new FileFileSystemOpenOptions(), { format = new FileFileSystemOptions().format, maxFileSize = new FileFileSystemOptions().maxFileSize }: FileFileSystemOptions = new FileFileSystemOptions()) {
        var fileSystem = new FileFileSystem(file, { autoSave })

        if (Math.round(maxFileSize) != maxFileSize) {
            throw new ParamError("options.maxFileSize", "must be a whole number")
        }

        if (!fs.existsSync(file)) {
            fileSystem.data = new FileFileData("ffs;" + VERSION + "|0;0;" + maxFileSize + ";0;" + format + "||")
            fileSystem.save()
        } else {
            throw new FileAlreadyExistsError(file)
        }

        return fileSystem
    }

    public reload() {
        this.data = new FileFileData(fs.readFileSync(this.file, { encoding: "binary" }))
        this.data.meta.fileCount = this.data.table.entries.length
        this.data.meta.size = this.data.data.length

        return this.data
    }

    public save() {
        this.data.meta.fileCount = this.data.table.entries.length
        this.data.meta.size = this.data.toString().length
        this.data.meta.dataSize = this.data.data.length

        var oldData = null
        if (fs.existsSync(this.file)) {
            oldData = fs.readFileSync(this.file, { encoding: "binary" })
        }

        fs.writeFileSync(this.file, this.data.toString(), { encoding: "binary" })

        if (fs.statSync(this.file).size > this.data.meta.max) {
            if (oldData != null) {
                fs.writeFileSync(this.file, oldData, { encoding: "binary" })
            } else {
                fs.unlinkSync(this.file)
            }

            throw new Error("Can't save file because it would be larger than the max file size")
        }
    }

    private validPath(path: string) {
        if (path == null) {
            throw new NullError("path")
        }

        return !(path.includes("|") || path.includes(";") || path.includes(",") || path.includes("\\") || path.startsWith("/") || path.endsWith("/") || (this.data.meta.format == FileFileSystemFormat.FLAT && path.includes("/")))
    }

    private fixPath(path: string) {
        if (path == null) {
            throw new NullError("path")
        }

        path = path.replace(/\\/g, "/")

        if (path.startsWith("/")) {
            path = path.substring(1)
        }

        if (path.endsWith("/")) {
            path = path.substring(0, path.length - 1)
        }

        if (this.validPath(path)) {
            return path
        } else {
            throw new InvalidFilePathError(path)
        }
    }

    private validData(data: string) {
        if (data == null) {
            throw new NullError("data")
        }

        return !data.includes("|")
    }

    public diskMeta() {
        return this.data.meta
    }

    public exists(file: string) {
        if (file == null) {
            throw new NullError("file")
        }

        file = this.fixPath(file)

        for (var entry of this.data.table.entries) {
            if (entry.name == file || entry.name.startsWith(file + "/")) {
                return true
            }
        }

        return false
    }

    public statFile(file: string) {
        if (file == null) {
            throw new NullError("file")
        }

        file = this.fixPath(file)

        if (this.exists(file)) {
            for (var entry of this.data.table.entries) {
                if (entry.name == file) {
                    return new FileFileFileStats(entry.name, entry.length)
                }
            }

            throw new Error("Could not find file in table")
        } else {
            throw new FileNotExistsError(file)
        }
    }

    public createFile(file: string) {
        if (file == null) {
            throw new NullError("file")
        }

        file = this.fixPath(file)

        if (!this.exists(file)) {
            this.data.table.entries.push(new FileFileTableEntry(file, this.data.data.length + 1, 0))

            if (this.autoSave) {
                this.save()
            }
        } else {
            throw new FileAlreadyExistsError(file)
        }
    }

    public deleteFile(file: string) {
        if (file == null) {
            throw new NullError("file")
        }

        file = this.fixPath(file)

        if (this.exists(file)) {
            for (var entry of this.data.table.entries) {
                if (entry.name == file) {
                    for (var entry2 of this.data.table.entries) {
                        if (entry2.start > entry.start) {
                            entry2.start -= entry.length
                        }
                    }

                    this.data.table.entries.splice(this.data.table.entries.indexOf(entry), 1)
                    this.data.data = this.data.data.substring(0, (entry.start - 1)) + this.data.data.substring((entry.start - 1) + entry.length)

                    if (this.autoSave) {
                        this.save()
                    }

                    return
                }
            }

            throw new Error("Could not find file in table")
        } else {
            throw new FileNotExistsError(file)
        }
    }

    public readFile(file: string) {
        if (file == null) {
            throw new NullError("file")
        }

        file = this.fixPath(file)

        if (this.exists(file)) {
            for (var entry of this.data.table.entries) {
                if (entry.name == file) {
                    return this.data.data.substring((entry.start - 1), (entry.start - 1) + entry.length)
                }
            }

            throw new Error("Could not find file in table")
        } else {
            throw new FileNotExistsError(file)
        }
    }

    public readDir(dir: string) {
        if (dir == null) {
            throw new NullError("dir")
        }

        if (this.data.meta.format != FileFileSystemFormat.FLAT) {
            dir = this.fixPath(dir)

            if (this.exists(dir)) {
                var results = []

                for (var entry of this.data.table.entries) {
                    if (entry.name != dir && entry.name.startsWith(dir)) {
                        results.push(entry.name.substring(dir.length + 1))
                    }
                }

                return results
            } else {
                throw new FileNotExistsError(dir)
            }
        } else {
            throw new Error("This disk is flat")
        }
    }

    public writeFile(file: string, data: string) {
        if (file == null) {
            throw new NullError("file")
        }

        file = this.fixPath(file)

        if (data == null) {
            throw new NullError("data")
        }

        if (this.validData(data)) {
            if (this.exists(file)) {
                for (var entry of this.data.table.entries) {
                    if (entry.name == file) {
                        var prevLength = parseInt(entry.length.toString())
                        this.data.data = this.data.data.substring(0, (entry.start - 1)) + data + this.data.data.substring((entry.start - 1) + entry.length)
                        entry.length = data.length

                        for (var entry2 of this.data.table.entries) {
                            if (entry2.start > entry.start) {
                                entry2.start += entry.length - prevLength
                            }
                        }

                        if (this.autoSave) {
                            this.save()
                        }

                        return
                    }
                }

                throw new Error("Could not find file in table")
            } else {
                this.createFile(file)

                this.writeFile(file, data)
            }
        } else {
            throw new InvalidDataError()
        }
    }

    public appendFile(file: string, data: string) {
        this.writeFile(file, this.readFile(file) + data)
    }

    public renameFile(file: string, newFile: string) {
        if (file == null) {
            throw new NullError("file")
        }

        if (newFile == null) {
            throw new NullError("newFile")
        }

        file = this.fixPath(file)
        newFile = this.fixPath(newFile)

        if (this.exists(file)) {
            if (!this.exists(newFile)) {
                for (var entry of this.data.table.entries) {
                    if (entry.name == file) {
                        entry.name = newFile

                        if (this.autoSave) {
                            this.save()
                        }

                        return
                    }
                }

                throw new Error("Could not find file in table")
            } else {
                throw new FileAlreadyExistsError(newFile)
            }
        } else {
            throw new FileNotExistsError(file)
        }
    }

    public copyFile(source: string, dest: string) {
        if (source == null) {
            throw new NullError("source")
        }

        if (dest == null) {
            throw new NullError("dest")
        }

        this.writeFile(dest, this.readFile(source))
    }
}

class FileFileData {
    public static EMPTY: FileFileData

    private _header: FileFileHeader
    public get header() { return this._header }
    private _meta: FileFileMeta
    public get meta() { return this._meta }
    private _table: FileFileTable
    public get table() { return this._table }
    private _data: string
    public get data() { return this._data }
    public set data(value) { this._data = value }

    public constructor(raw: string) {
        if (raw == null) {
            throw new NullError("raw")
        }

        if (raw.split("|")[0] != null) {
            this._header = new FileFileHeader(raw.split("|")[0])
        } else {
            throw new MalformedFileError("File does not contain a header")
        }

        if (raw.split("|")[1] != null) {
            this._meta = new FileFileMeta(raw.split("|")[1])
        } else {
            throw new MalformedFileError("File does not contain meta")
        }

        if (raw.split("|")[2] != null) {
            this._table = new FileFileTable(raw.split("|")[2])
        } else {
            throw new MalformedFileError("File does not contain a table")
        }

        if (raw.split("|")[3] != null) {
            this._data = raw.split("|")[3]
        } else {
            throw new MalformedFileError("File does not contain file data")
        }
    }

    public toString() {
        return this.header.toString() + "|" + this.meta.toString() + "|" + this.table.toString() + "|" + this.data.toString()
    }
}

class FileFileHeader {
    public version: number

    public constructor(raw: string) {
        if (raw == null) {
            throw new NullError("raw")
        }

        if (raw.split(";")[0] != "ffs") {
            throw new MalformedFileError("File is not a ffs file")
        }

        if (raw.split(";")[1] != null) {
            this.version = parseInt(raw.split(";")[1])

            if (this.version == NaN) {
                throw new MalformedFileError("Header version is not a valid number")
            }
        } else {
            throw new MalformedFileError("Header does not contain a version")
        }

        if (this.version != VERSION) {
            throw new MalformedFileError("File uses an unknown or unsupported version")
        }
    }

    public toString() {
        return "ffs;" + this.version
    }
}

class FileFileMeta {
    public size: number
    public dataSize: number
    public max: number

    public fileCount: number

    private _format: FileFileSystemFormat
    public get format() { return this._format }

    public constructor(raw: string) {
        if (raw == null) {
            throw new NullError("raw")
        }

        if (raw.split(";")[0] != null) {
            this.size = parseInt(raw.split(";")[0])

            if (this.size == NaN) {
                throw new MalformedFileError("Meta size is not a valid number")
            }
        } else {
            throw new MalformedFileError("Meta does not contain a size")
        }

        if (raw.split(";")[1] != null) {
            this.dataSize = parseInt(raw.split(";")[1])

            if (this.size == NaN) {
                throw new MalformedFileError("Meta data size is not a valid number")
            }
        } else {
            throw new MalformedFileError("Meta does not contain a data size")
        }

        if (raw.split(";")[2] != null) {
            this.max = parseInt(raw.split(";")[2])

            if (this.size == NaN) {
                throw new MalformedFileError("Meta max size is not a valid number")
            }
        } else {
            throw new MalformedFileError("Meta does not contain a max size")
        }

        if (raw.split(";")[3] != null) {
            this.fileCount = parseInt(raw.split(";")[3])

            if (this.size == NaN) {
                throw new MalformedFileError("Meta file count is not a valid number")
            }
        } else {
            throw new MalformedFileError("Meta does not contain a file count")
        }

        if (raw.split(";")[4] != null) {
            this._format = parseInt(raw.split(";")[4])

            if (this.size == NaN) {
                throw new MalformedFileError("Meta format is not a valid number")
            }
        } else {
            throw new MalformedFileError("Meta does not contain a format")
        }
    }

    public toString() {
        return this.size + ";" + this.dataSize + ";" + this.max + ";" + this.fileCount + ";" + this._format
    }
}

class FileFileTable {
    public entries: FileFileTableEntry[]

    public constructor(raw: string) {
        if (raw == null) {
            throw new NullError("raw")
        }

        this.entries = []
        raw.split(",").forEach((rawEntry: string) => {
            if (rawEntry == "") {
                return
            }

            if (rawEntry.split(";")[0] == null) {
                throw new MalformedFileError("Table entry does not contain a name")
            }

            if (rawEntry.split(";")[1] == null) {
                throw new MalformedFileError("Table entry does not contain a start")
            }

            if (rawEntry.split(";")[2] == null) {
                throw new MalformedFileError("Table entry does not contain a size")
            }

            this.entries.push(new FileFileTableEntry(rawEntry.split(";")[0], parseInt(rawEntry.split(";")[1]), parseInt(rawEntry.split(";")[2])))
        })
    }

    public toString() {
        var string = ""

        this.entries.forEach((entry: FileFileTableEntry) => {
            string += entry.toString() + ","
        })

        return string.substring(0, string.length - 1)
    }
}

class FileFileTableEntry {
    public name: string

    public start: number
    public length: number

    public constructor(name: string, start: number, length: number) {
        this.name = name

        this.start = start
        this.length = length
    }

    public toString() {
        return this.name + ";" + this.start + ";" + this.length
    }
}

class FileFileFileStats {
    private _name: string
    public get name() { return this._name }

    private _size: number
    public get size() { return this._size }

    public constructor(name: string, size: number) {
        this._name = name

        this._size = size
    }
}

FileFileData.EMPTY = new FileFileData("ffs;" + VERSION + "|0;0;0;0;0||")

module.exports = {
    VERSION,
    FileFileSystem,
    FileFileSystemOptions,
    FileFileSystemFormat,
    FileFileSystemOpenOptions,
    NullError,
    ParamError,
    FilePathError,
    MalformedFileError,
    FileNotExistsError,
    FileAlreadyExistsError,
    InvalidFilePathError,
    InvalidDataError
}