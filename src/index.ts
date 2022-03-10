const fs = require("fs")

class NullError extends Error { public constructor(element: string) { super("NullError: " + element + " can not be null") } }
class ParamError extends Error { public constructor(element: string, reason: string) { super("ParamError: " + element + " " + reason) } }
class FilePathError extends Error { public constructor(path: string, reason?: string) { super("FilePathError: " + path + " is not a valid path" + (reason != null ? ": " + reason : "")) } }
class MalformedFileError extends Error { public constructor(reason: string) { super("Invalid or corrupt file: " + reason) } }
class FileNotExistsError extends Error { public constructor(file: string) { super("File " + file + " does not exist") } }
class FileExistsError extends Error { public constructor(file: string) { super("File " + file + " already exists") } }
class InvalidFilePathError extends Error { public constructor(file: string) { super("Path " + file + " is not valid/allowed") } }
class InvalidDataError extends Error { public constructor(file: string) { super("That data is not valid/allowed") } }

namespace filefilesystem {
    const VERSION = "1"

    class FileFileSystem {
        private _file: string
        public get file() { return this._file }

        private data: FileFileData

        public constructor(file: string, maxFileSize?: number) {
            if (file == null) {
                throw new NullError("file")
            }

            if (!file.endsWith(".ffs")) {
                throw new FilePathError(file, "File must end in .ffs")
            }

            if (maxFileSize == null) {
                maxFileSize = Math.pow(2, 31) - 1
            }

            if (Math.round(maxFileSize) != maxFileSize) {
                throw new ParamError("maxFileSize", "must be a whole number")
            }

            this._file = file

            if (!fs.existsSync(file)) {
                this.data = new FileFileData("ffs;1\\s0;" + maxFileSize + ";0\\s\\s")
                this.save()
            } else {
                this.data = this.load()
            }
        }

        public load() {
            this.data = new FileFileData(fs.readFileSync(this.file, { encoding: "binary" }))
            this.data.meta.fileCount = this.data.table.entries.length
            this.data.meta.size = this.data.data.length

            return this.data
        }

        public save() {
            this.data.meta.fileCount = this.data.table.entries.length
            this.data.meta.size = this.data.data.length
            fs.writeFileSync(this.file, this.data.toString(), { encoding: "binary" })
        }

        public validPath(path: string) {
            return !path.includes("\\") && !path.includes(";") && !path.includes(",") && !path.startsWith("/") && !path.endsWith("/")
        }

        public fixPath(path: string) {
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
                return ""
            }
        }

        public validData(data: string) {
            return !data.includes("\\s")
        }

        public exists(file: string) {
            file = this.fixPath(file)

            for (var entry of this.data.table.entries) {
                if (entry.name == file || entry.name.startsWith(file + "/")) {
                    return true
                }
            }

            return false
        }

        public statFile(file: string) {
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
            file = this.fixPath(file)

            if (!this.exists(file)) {
                this.data.table.entries.push(new FileFileTableEntry(file, this.data.data.length + 1, 0))
            } else {
                throw new FileExistsError(file)
            }
        }

        public deleteFile(file: string) {
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

                        return
                    }
                }

                throw new Error("Could not find file in table")
            } else {
                throw new FileNotExistsError(file)
            }
        }

        public readFile(file: string) {
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
            dir = this.fixPath(dir)

            if (this.exists(dir)) {
                var results = []

                for (var entry of this.data.table.entries) {
                    if (entry.name.startsWith(dir)) {
                        results.push(entry.name.substring(dir.length + 1))
                    }
                }

                return results
            } else {
                throw new FileNotExistsError(dir)
            }
        }

        public writeFile(file: string, data: string) {
            file = this.fixPath(file)

            if (this.validData(data)) {
                if (this.exists(file)) {
                    for (var entry of this.data.table.entries) {
                        if (entry.name == file) {
                            var prevlength = parseInt(entry.length.toString())
                            this.data.data = this.data.data.substring(0, (entry.start - 1)) + data + this.data.data.substring((entry.start - 1) + entry.length)
                            entry.length = data.length

                            for (var entry2 of this.data.table.entries) {
                                if (entry2.start > entry.start) {
                                    entry2.start += entry.length - prevlength
                                }
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
                throw new InvalidDataError(data)
            }
        }

        public appendFile(file: string, data: string) {
            this.writeFile(file, this.readFile(file) + data)
        }

        public renameFile(file: string, newname: string) {
            file = this.fixPath(file)
            newname = this.fixPath(newname)

            if (this.exists(file)) {
                for (var entry of this.data.table.entries) {
                    if (entry.name == file) {
                        entry.name = newname

                        return
                    }
                }

                throw new Error("Could not find file in table")
            }
        }

        public copyFile(file: string, dest: string) {
            this.writeFile(dest, this.readFile(file))
        }
    }

    class FileFileData {
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

            if (raw.split("\\s")[0] != null) {
                this._header = new FileFileHeader(raw.split("\\s")[0])
            } else {
                throw new MalformedFileError("File does not contain a header")
            }

            if (raw.split("\\s")[1] != null) {
                this._meta = new FileFileMeta(raw.split("\\s")[1])
            } else {
                throw new MalformedFileError("File does not contain meta")
            }

            if (raw.split("\\s")[2] != null) {
                this._table = new FileFileTable(raw.split("\\s")[2])
            } else {
                throw new MalformedFileError("File does not contain a table")
            }

            if (raw.split("\\s")[3] != null) {
                this._data = raw.split("\\s")[3]
            } else {
                throw new MalformedFileError("File does not contain file data")
            }
        }

        public toString() {
            return this.header.toString() + "\\s" + this.meta.toString() + "\\s" + this.table.toString() + "\\s" + this.data.toString()
        }
    }

    class FileFileHeader {
        public version: string

        public constructor(raw: string) {
            if (raw == null) {
                throw new NullError("raw")
            }

            if (raw.split(";")[0] != "ffs") {
                throw new MalformedFileError("File is not a ffs file")
            }

            if (raw.split(";")[1] != null) {
                this.version = raw.split(";")[1]
            } else {
                throw new MalformedFileError("File does not contain a version")
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
        public max: number

        public fileCount: number

        public constructor(raw: string) {
            if (raw == null) {
                throw new NullError("raw")
            }

            if (raw.split(";")[0] != null) {
                this.size = parseInt(raw.split(";")[0])
            } else {
                throw new MalformedFileError("File does not contain a size")
            }

            if (raw.split(";")[1] != null) {
                this.max = parseInt(raw.split(";")[1])
            } else {
                throw new MalformedFileError("File does not contain a max size")
            }

            if (raw.split(";")[2] != null) {
                this.fileCount = parseInt(raw.split(";")[2])
            } else {
                throw new MalformedFileError("File does not contain a file count")
            }
        }

        public toString() {
            return this.size + ";" + this.max + ";" + this.fileCount
        }
    }

    class FileFileTable {
        public entries: FileFileTableEntry[]

        public constructor(raw: string) {
            if (raw == null) {
                throw new NullError("raw")
            }

            this.entries = []
            raw.split(",").forEach((rawentry: string) => {
                if (rawentry == "") {
                    return
                }

                if (rawentry.split(";")[0] == null) {
                    throw new MalformedFileError("Table entry does not contain a name")
                }
                if (rawentry.split(";")[1] == null) {
                    throw new MalformedFileError("Table entry does not contain a start")
                }
                if (rawentry.split(";")[2] == null) {
                    throw new MalformedFileError("Table entry does not contain a size")
                }

                this.entries.push(new FileFileTableEntry(rawentry.split(";")[0], parseInt(rawentry.split(";")[1]), parseInt(rawentry.split(";")[2])))
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

    module.exports = {
        VERSION,
        filefilesystem,
        FileFileSystem,
        FileFileData,
        FileFileHeader,
        FileFileMeta,
        FileFileTable,
        FileFileTableEntry,
        FileFileFileStats,
        NullError,
        ParamError,
        FilePathError,
        MalformedFileError
    }
}