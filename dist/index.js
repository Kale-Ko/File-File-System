const fs = require("fs");
class NullError extends Error {
    constructor(element) { super("NullError: " + element + " can not be null"); }
}
class ParamError extends Error {
    constructor(element, reason) { super("ParamError: " + element + " " + reason); }
}
class FilePathError extends Error {
    constructor(path, reason) { super("FilePathError: " + path + " is not a valid path" + (reason != null ? ": " + reason : "")); }
}
class MalformedFileError extends Error {
    constructor(reason) { super("Invalid or corrupt file: " + reason); }
}
class FileNotExistsError extends Error {
    constructor(file) { super("File " + file + " does not exist"); }
}
class FileAlreadyExistsError extends Error {
    constructor(file) { super("File " + file + " already exists"); }
}
class InvalidFilePathError extends Error {
    constructor(file) { super("Path " + file + " is not valid/allowed"); }
}
class InvalidDataError extends Error {
    constructor(file) { super("That data is not valid/allowed"); }
}
const VERSION = 2;
class FileFileSystemOpenOptions {
    autoLoad = true;
    autoSave = true;
}
var FileFileSystemFormat;
(function (FileFileSystemFormat) {
    FileFileSystemFormat[FileFileSystemFormat["NORMAL"] = 0] = "NORMAL";
    FileFileSystemFormat[FileFileSystemFormat["FLAT"] = 1] = "FLAT";
})(FileFileSystemFormat || (FileFileSystemFormat = {}));
class FileFileSystemOptions {
    format = FileFileSystemFormat.NORMAL;
    maxFileSize = Math.pow(2, 31) - 1;
}
class FileFileSystem {
    _file;
    get file() { return this._file; }
    data = FileFileData.EMPTY;
    autoSave;
    constructor(file, { autoSave = new FileFileSystemOpenOptions().autoSave } = new FileFileSystemOpenOptions()) {
        if (file == null) {
            throw new NullError("file");
        }
        if (!file.endsWith(".ffs")) {
            throw new FilePathError(file, "File must end in .ffs");
        }
        this._file = file;
        if (autoSave == null) {
            throw new NullError("autoSave");
        }
        this.autoSave = autoSave;
    }
    static createIfNotExist(file, { autoLoad = new FileFileSystemOpenOptions().autoLoad, autoSave = new FileFileSystemOpenOptions().autoSave } = new FileFileSystemOpenOptions(), { format = new FileFileSystemOptions().format, maxFileSize = new FileFileSystemOptions().maxFileSize } = new FileFileSystemOptions()) {
        if (file == null) {
            throw new NullError("file");
        }
        if (!file.endsWith(".ffs")) {
            throw new FilePathError(file, "File must end in .ffs");
        }
        if (!fs.existsSync(file)) {
            return FileFileSystem.create(file, { autoLoad, autoSave }, { format, maxFileSize });
        }
        else {
            return FileFileSystem.load(file, { autoLoad, autoSave });
        }
    }
    static load(file, { autoLoad = new FileFileSystemOpenOptions().autoLoad, autoSave = new FileFileSystemOpenOptions().autoSave } = new FileFileSystemOpenOptions()) {
        var fileSystem = new FileFileSystem(file, { autoLoad, autoSave });
        if (fs.existsSync(file) && autoLoad) {
            fileSystem.reload();
        }
        else {
            throw new FileNotExistsError(file);
        }
        return fileSystem;
    }
    static create(file, { autoSave = new FileFileSystemOpenOptions().autoSave } = new FileFileSystemOpenOptions(), { format = new FileFileSystemOptions().format, maxFileSize = new FileFileSystemOptions().maxFileSize } = new FileFileSystemOptions()) {
        var fileSystem = new FileFileSystem(file, { autoLoad: false, autoSave });
        if (Math.round(maxFileSize) != maxFileSize) {
            throw new ParamError("options.maxFileSize", "must be a whole number");
        }
        if (!fs.existsSync(file)) {
            fileSystem.data = new FileFileData("ffs;" + VERSION + "|0;0;" + maxFileSize + ";0;" + format + "||");
            fileSystem.save();
        }
        else {
            throw new FileAlreadyExistsError(file);
        }
        return fileSystem;
    }
    reload() {
        this.data = new FileFileData(fs.readFileSync(this.file, { encoding: "binary" }));
        this.data.meta.fileCount = this.data.table.entries.length;
        this.data.meta.size = this.data.data.length;
        return this.data;
    }
    save() {
        this.data.meta.fileCount = this.data.table.entries.length;
        this.data.meta.size = this.data.toString().length;
        this.data.meta.dataSize = this.data.data.length;
        if (this.data.meta.size <= this.data.meta.max) {
            fs.writeFileSync(this.file, this.data.toString(), { encoding: "binary" });
        }
        else {
            throw new Error("Can't save file because it would be larger than the max file size");
        }
    }
    validPath(path) {
        if (path == null) {
            throw new NullError("path");
        }
        return !(path.includes("|") || path.includes(";") || path.includes(",") || path.includes("\\") || path.startsWith("/") || path.endsWith("/") || (this.data.meta.format == FileFileSystemFormat.FLAT && path.includes("/")));
    }
    fixPath(path) {
        if (path == null) {
            throw new NullError("path");
        }
        path = path.replace(/\\/g, "/");
        if (path.startsWith("/")) {
            path = path.substring(1);
        }
        if (path.endsWith("/")) {
            path = path.substring(0, path.length - 1);
        }
        if (this.validPath(path)) {
            return path;
        }
        else {
            throw new InvalidFilePathError(path);
        }
    }
    validData(data) {
        if (data == null) {
            throw new NullError("data");
        }
        return !data.includes("|");
    }
    diskMeta() {
        return this.data.meta;
    }
    exists(file) {
        if (file == null) {
            throw new NullError("file");
        }
        file = this.fixPath(file);
        for (var entry of this.data.table.entries) {
            if (entry.name == file || entry.name.startsWith(file + "/")) {
                return true;
            }
        }
        return false;
    }
    statFile(file) {
        if (file == null) {
            throw new NullError("file");
        }
        file = this.fixPath(file);
        if (this.exists(file)) {
            for (var entry of this.data.table.entries) {
                if (entry.name == file) {
                    return new FileFileFileStats(entry.name, entry.length);
                }
            }
            throw new Error("Could not find file in table");
        }
        else {
            throw new FileNotExistsError(file);
        }
    }
    createFile(file) {
        if (file == null) {
            throw new NullError("file");
        }
        file = this.fixPath(file);
        if (!this.exists(file)) {
            this.data.table.entries.push(new FileFileTableEntry(file, this.data.data.length + 1, 0));
            if (this.autoSave) {
                this.save();
            }
        }
        else {
            throw new FileAlreadyExistsError(file);
        }
    }
    deleteFile(file) {
        if (file == null) {
            throw new NullError("file");
        }
        file = this.fixPath(file);
        if (this.exists(file)) {
            for (var entry of this.data.table.entries) {
                if (entry.name == file) {
                    for (var entry2 of this.data.table.entries) {
                        if (entry2.start > entry.start) {
                            entry2.start -= entry.length;
                        }
                    }
                    this.data.table.entries.splice(this.data.table.entries.indexOf(entry), 1);
                    this.data.data = this.data.data.substring(0, (entry.start - 1)) + this.data.data.substring((entry.start - 1) + entry.length);
                    if (this.autoSave) {
                        this.save();
                    }
                    return;
                }
            }
            throw new Error("Could not find file in table");
        }
        else {
            throw new FileNotExistsError(file);
        }
    }
    readFile(file) {
        if (file == null) {
            throw new NullError("file");
        }
        file = this.fixPath(file);
        if (this.exists(file)) {
            for (var entry of this.data.table.entries) {
                if (entry.name == file) {
                    return this.data.data.substring((entry.start - 1), (entry.start - 1) + entry.length);
                }
            }
            throw new Error("Could not find file in table");
        }
        else {
            throw new FileNotExistsError(file);
        }
    }
    readDir(dir) {
        if (dir == null) {
            throw new NullError("dir");
        }
        if (this.data.meta.format != FileFileSystemFormat.FLAT) {
            dir = this.fixPath(dir);
            if (this.exists(dir)) {
                var results = [];
                for (var entry of this.data.table.entries) {
                    if (entry.name != dir && entry.name.startsWith(dir)) {
                        results.push(entry.name.substring(dir.length + 1));
                    }
                }
                return results;
            }
            else {
                throw new FileNotExistsError(dir);
            }
        }
        else {
            throw new Error("This disk is flat");
        }
    }
    writeFile(file, data) {
        if (file == null) {
            throw new NullError("file");
        }
        file = this.fixPath(file);
        if (data == null) {
            throw new NullError("data");
        }
        if (this.validData(data)) {
            if (this.exists(file)) {
                for (var entry of this.data.table.entries) {
                    if (entry.name == file) {
                        var prevLength = parseInt(entry.length.toString());
                        this.data.data = this.data.data.substring(0, (entry.start - 1)) + data + this.data.data.substring((entry.start - 1) + entry.length);
                        entry.length = data.length;
                        for (var entry2 of this.data.table.entries) {
                            if (entry2.start > entry.start) {
                                entry2.start += entry.length - prevLength;
                            }
                        }
                        if (this.autoSave) {
                            this.save();
                        }
                        return;
                    }
                }
                throw new Error("Could not find file in table");
            }
            else {
                this.createFile(file);
                this.writeFile(file, data);
            }
        }
        else {
            throw new InvalidDataError(data);
        }
    }
    appendFile(file, data) {
        this.writeFile(file, this.readFile(file) + data);
    }
    renameFile(file, newFile) {
        if (file == null) {
            throw new NullError("file");
        }
        if (newFile == null) {
            throw new NullError("newFile");
        }
        file = this.fixPath(file);
        newFile = this.fixPath(newFile);
        if (this.exists(file)) {
            if (!this.exists(newFile)) {
                for (var entry of this.data.table.entries) {
                    if (entry.name == file) {
                        entry.name = newFile;
                        if (this.autoSave) {
                            this.save();
                        }
                        return;
                    }
                }
                throw new Error("Could not find file in table");
            }
            else {
                throw new FileAlreadyExistsError(newFile);
            }
        }
        else {
            throw new FileNotExistsError(file);
        }
    }
    copyFile(source, dest) {
        if (source == null) {
            throw new NullError("source");
        }
        if (dest == null) {
            throw new NullError("dest");
        }
        this.writeFile(dest, this.readFile(source));
    }
}
class FileFileData {
    static EMPTY;
    _header;
    get header() { return this._header; }
    _meta;
    get meta() { return this._meta; }
    _table;
    get table() { return this._table; }
    _data;
    get data() { return this._data; }
    set data(value) { this._data = value; }
    constructor(raw) {
        if (raw == null) {
            throw new NullError("raw");
        }
        if (raw.split("|")[0] != null) {
            this._header = new FileFileHeader(raw.split("|")[0]);
        }
        else {
            throw new MalformedFileError("File does not contain a header");
        }
        if (raw.split("|")[1] != null) {
            this._meta = new FileFileMeta(raw.split("|")[1]);
        }
        else {
            throw new MalformedFileError("File does not contain meta");
        }
        if (raw.split("|")[2] != null) {
            this._table = new FileFileTable(raw.split("|")[2]);
        }
        else {
            throw new MalformedFileError("File does not contain a table");
        }
        if (raw.split("|")[3] != null) {
            this._data = raw.split("|")[3];
        }
        else {
            throw new MalformedFileError("File does not contain file data");
        }
    }
    toString() {
        return this.header.toString() + "|" + this.meta.toString() + "|" + this.table.toString() + "|" + this.data.toString();
    }
}
class FileFileHeader {
    version;
    constructor(raw) {
        if (raw == null) {
            throw new NullError("raw");
        }
        if (raw.split(";")[0] != "ffs") {
            throw new MalformedFileError("File is not a ffs file");
        }
        if (raw.split(";")[1] != null) {
            this.version = parseInt(raw.split(";")[1]);
            if (this.version == NaN) {
                throw new MalformedFileError("Header version is not a valid number");
            }
        }
        else {
            throw new MalformedFileError("Header does not contain a version");
        }
        if (this.version != VERSION) {
            throw new MalformedFileError("File uses an unknown or unsupported version");
        }
    }
    toString() {
        return "ffs;" + this.version;
    }
}
class FileFileMeta {
    size;
    dataSize;
    max;
    fileCount;
    _format;
    get format() { return this._format; }
    constructor(raw) {
        if (raw == null) {
            throw new NullError("raw");
        }
        if (raw.split(";")[0] != null) {
            this.size = parseInt(raw.split(";")[0]);
            if (this.size == NaN) {
                throw new MalformedFileError("Meta size is not a valid number");
            }
        }
        else {
            throw new MalformedFileError("Meta does not contain a size");
        }
        if (raw.split(";")[1] != null) {
            this.dataSize = parseInt(raw.split(";")[1]);
            if (this.size == NaN) {
                throw new MalformedFileError("Meta data size is not a valid number");
            }
        }
        else {
            throw new MalformedFileError("Meta does not contain a data size");
        }
        if (raw.split(";")[2] != null) {
            this.max = parseInt(raw.split(";")[2]);
            if (this.size == NaN) {
                throw new MalformedFileError("Meta max size is not a valid number");
            }
        }
        else {
            throw new MalformedFileError("Meta does not contain a max size");
        }
        if (raw.split(";")[3] != null) {
            this.fileCount = parseInt(raw.split(";")[3]);
            if (this.size == NaN) {
                throw new MalformedFileError("Meta file count is not a valid number");
            }
        }
        else {
            throw new MalformedFileError("Meta does not contain a file count");
        }
        if (raw.split(";")[4] != null) {
            this._format = parseInt(raw.split(";")[4]);
            if (this.size == NaN) {
                throw new MalformedFileError("Meta format is not a valid number");
            }
        }
        else {
            throw new MalformedFileError("Meta does not contain a format");
        }
    }
    toString() {
        return this.size + ";" + this.dataSize + ";" + this.max + ";" + this.fileCount + ";" + this._format;
    }
}
class FileFileTable {
    entries;
    constructor(raw) {
        if (raw == null) {
            throw new NullError("raw");
        }
        this.entries = [];
        raw.split(",").forEach((rawEntry) => {
            if (rawEntry == "") {
                return;
            }
            if (rawEntry.split(";")[0] == null) {
                throw new MalformedFileError("Table entry does not contain a name");
            }
            if (rawEntry.split(";")[1] == null) {
                throw new MalformedFileError("Table entry does not contain a start");
            }
            if (rawEntry.split(";")[2] == null) {
                throw new MalformedFileError("Table entry does not contain a size");
            }
            this.entries.push(new FileFileTableEntry(rawEntry.split(";")[0], parseInt(rawEntry.split(";")[1]), parseInt(rawEntry.split(";")[2])));
        });
    }
    toString() {
        var string = "";
        this.entries.forEach((entry) => {
            string += entry.toString() + ",";
        });
        return string.substring(0, string.length - 1);
    }
}
class FileFileTableEntry {
    name;
    start;
    length;
    constructor(name, start, length) {
        this.name = name;
        this.start = start;
        this.length = length;
    }
    toString() {
        return this.name + ";" + this.start + ";" + this.length;
    }
}
class FileFileFileStats {
    _name;
    get name() { return this._name; }
    _size;
    get size() { return this._size; }
    constructor(name, size) {
        this._name = name;
        this._size = size;
    }
}
FileFileData.EMPTY = new FileFileData("ffs;" + VERSION + "|0;0;0;0;0||");
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
};
