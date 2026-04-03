"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var cosmos_1 = require("@azure/cosmos");
var cors_1 = require("cors");
var dotenv_1 = require("dotenv");
var path_1 = require("path");
var url_1 = require("url");
var __filename = (0, url_1.fileURLToPath)(import.meta.url);
var __dirname = path_1.default.dirname(__filename);
dotenv_1.default.config({ path: path_1.default.join(__dirname, '.env') });
var app = (0, express_1.default)();
var PORT = process.env.PORT || 3001;
var COSMOS_ENDPOINT = process.env.COSMOS_ENDPOINT;
var COSMOS_KEY = process.env.COSMOS_KEY;
var COSMOS_DATABASE = process.env.COSMOS_DATABASE || 'dsa-cookbook';
if (!COSMOS_ENDPOINT || !COSMOS_KEY) {
    console.error('Missing COSMOS_ENDPOINT or COSMOS_KEY in .env');
    process.exit(1);
}
var cosmosClient = new cosmos_1.CosmosClient({
    endpoint: COSMOS_ENDPOINT,
    key: COSMOS_KEY,
    connectionPolicy: {
        requestTimeout: 10000, // 10s timeout
    }
});
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Log all requests
app.use(function (req, _res, next) {
    console.log("[".concat(new Date().toISOString(), "] ").concat(req.method, " ").concat(req.url));
    next();
});
function getDatabase() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, cosmosClient.database(COSMOS_DATABASE)];
        });
    });
}
function getContainer(containerName) {
    return __awaiter(this, void 0, void 0, function () {
        var db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getDatabase()];
                case 1:
                    db = _a.sent();
                    return [2 /*return*/, db.container(containerName)];
            }
        });
    });
}
// Initialization: Verify connection and database/containers
function initialize() {
    return __awaiter(this, void 0, void 0, function () {
        var db, containers, _i, containers_1, name_1, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('Connecting to Cosmos DB...');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 7, , 8]);
                    return [4 /*yield*/, cosmosClient.database(COSMOS_DATABASE).read()];
                case 2:
                    db = _a.sent();
                    console.log("Successfully connected to database: ".concat(db.database.id));
                    containers = ['topics', 'problems'];
                    _i = 0, containers_1 = containers;
                    _a.label = 3;
                case 3:
                    if (!(_i < containers_1.length)) return [3 /*break*/, 6];
                    name_1 = containers_1[_i];
                    return [4 /*yield*/, cosmosClient.database(COSMOS_DATABASE).container(name_1).read()];
                case 4:
                    _a.sent();
                    console.log("Container connected: ".concat(name_1));
                    _a.label = 5;
                case 5:
                    _i++;
                    return [3 /*break*/, 3];
                case 6:
                    console.log('Cosmos DB initialization successful.');
                    return [3 /*break*/, 8];
                case 7:
                    error_1 = _a.sent();
                    console.error('Failed to initialize Cosmos DB connection:');
                    console.error(error_1);
                    return [3 /*break*/, 8];
                case 8: return [2 /*return*/];
            }
        });
    });
}
initialize();
// Health endpoint for keep-alive monitoring
app.get('/health', function (_req, res) {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});
// Get all topics
app.get('/api/topics', function (_req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var container, resources, error_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                return [4 /*yield*/, getContainer('topics')];
            case 1:
                container = _a.sent();
                return [4 /*yield*/, container.items.query('SELECT * FROM c').fetchAll()];
            case 2:
                resources = (_a.sent()).resources;
                res.json(resources);
                return [3 /*break*/, 4];
            case 3:
                error_2 = _a.sent();
                console.error('Error fetching topics:', error_2);
                res.status(500).json({ error: 'Failed to fetch topics from Cosmos DB' });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
// Get single topic by slug
app.get('/api/topics/:slug', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var container, resources, error_3;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                return [4 /*yield*/, getContainer('topics')];
            case 1:
                container = _a.sent();
                return [4 /*yield*/, container.items.query({
                        query: 'SELECT * FROM c WHERE c.slug = @slug',
                        parameters: [{ name: '@slug', value: req.params.slug }]
                    }).fetchAll()];
            case 2:
                resources = (_a.sent()).resources;
                if (resources.length === 0) {
                    return [2 /*return*/, res.status(404).json({ error: 'Topic not found' })];
                }
                res.json(resources[0]);
                return [3 /*break*/, 4];
            case 3:
                error_3 = _a.sent();
                console.error('Error fetching topic:', error_3);
                res.status(500).json({ error: 'Failed to fetch topic from Cosmos DB' });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
// Get all problems
app.get('/api/problems', function (_req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var container, resources, error_4;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                return [4 /*yield*/, getContainer('problems')];
            case 1:
                container = _a.sent();
                return [4 /*yield*/, container.items.query('SELECT * FROM c').fetchAll()];
            case 2:
                resources = (_a.sent()).resources;
                res.json(resources);
                return [3 /*break*/, 4];
            case 3:
                error_4 = _a.sent();
                console.error('Error fetching problems:', error_4);
                res.status(500).json({ error: 'Failed to fetch problems from Cosmos DB' });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
// Get single problem by slug
app.get('/api/problems/:slug', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var container, resources, error_5;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                return [4 /*yield*/, getContainer('problems')];
            case 1:
                container = _a.sent();
                return [4 /*yield*/, container.items.query({
                        query: 'SELECT * FROM c WHERE c.slug = @slug',
                        parameters: [{ name: '@slug', value: req.params.slug }]
                    }).fetchAll()];
            case 2:
                resources = (_a.sent()).resources;
                if (resources.length === 0) {
                    return [2 /*return*/, res.status(404).json({ error: 'Problem not found' })];
                }
                res.json(resources[0]);
                return [3 /*break*/, 4];
            case 3:
                error_5 = _a.sent();
                console.error('Error fetching problem:', error_5);
                res.status(500).json({ error: 'Failed to fetch problem from Cosmos DB' });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
// Get problems for a topic
app.get('/api/topics/:topicSlug/problems', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var container, resources, error_6;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                return [4 /*yield*/, getContainer('problems')];
            case 1:
                container = _a.sent();
                return [4 /*yield*/, container.items.query({
                        query: 'SELECT * FROM c WHERE c.topicSlug = @topicSlug',
                        parameters: [{ name: '@topicSlug', value: req.params.topicSlug }]
                    }).fetchAll()];
            case 2:
                resources = (_a.sent()).resources;
                res.json(resources);
                return [3 /*break*/, 4];
            case 3:
                error_6 = _a.sent();
                console.error('Error fetching problems for topic:', error_6);
                res.status(500).json({ error: 'Failed to fetch problems for topic from Cosmos DB' });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
app.listen(PORT, function () {
    console.log("Cosmos DB API server running on http://localhost:".concat(PORT));
    console.log("Database: ".concat(COSMOS_DATABASE));
});
