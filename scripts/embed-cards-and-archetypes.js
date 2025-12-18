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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
var supabase_js_1 = require("@supabase/supabase-js");
var supabaseUrl = process.env.SUPABASE_URL;
var supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
var supabaseFunctionsUrl = (_a = process.env.SUPABASE_FUNCTIONS_URL) !== null && _a !== void 0 ? _a : "".concat(supabaseUrl, "/functions/v1");
if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}
var supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceRoleKey);
// Tune these
var BATCH_SIZE = 100;
var SLEEP_MS = 200; // avoid hammering edge function
function sleep(ms) {
    return new Promise(function (res) { return setTimeout(res, ms); });
}
function embedText(text) {
    return __awaiter(this, void 0, void 0, function () {
        var res, t, json;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fetch("".concat(supabaseFunctionsUrl, "/embed"), {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            // If your embed function requires auth, pass a service token header
                            Authorization: "Bearer ".concat(supabaseServiceRoleKey),
                        },
                        body: JSON.stringify({ input: text }),
                    })];
                case 1:
                    res = _a.sent();
                    if (!!res.ok) return [3 /*break*/, 3];
                    return [4 /*yield*/, res.text()];
                case 2:
                    t = _a.sent();
                    throw new Error("Embed error: ".concat(res.status, " ").concat(t));
                case 3: return [4 /*yield*/, res.json()];
                case 4:
                    json = (_a.sent());
                    if (!json.embedding || !Array.isArray(json.embedding)) {
                        throw new Error("Embed response missing embedding");
                    }
                    return [2 /*return*/, json.embedding];
            }
        });
    });
}
function buildCardText(card) {
    var _a;
    // Compact but semantically rich representation
    var parts = [
        card.name,
        card.archetype ? "Archetype: ".concat(card.archetype) : "",
        card.type ? "Type: ".concat(card.type) : "",
        card.race ? "Race: ".concat(card.race) : "",
        card.attribute ? "Attribute: ".concat(card.attribute) : "",
        card.level ? "Level: ".concat(card.level) : "",
        card.atk != null ? "ATK: ".concat(card.atk) : "",
        card.def != null ? "DEF: ".concat(card.def) : "",
        (_a = card.desc) !== null && _a !== void 0 ? _a : "",
    ];
    return parts.filter(Boolean).join(" | ");
}
function embedCards() {
    return __awaiter(this, void 0, void 0, function () {
        var offset, _a, cards, error, _i, cards_1, card, _b, existing, exErr, input, embedding, upErr;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    console.log("Embedding cards…");
                    offset = 0;
                    _c.label = 1;
                case 1: return [4 /*yield*/, supabase
                        .from("cards")
                        .select("id, name, type, race, attribute, archetype, level, atk, def, desc")
                        .order("id", { ascending: true })
                        .range(offset, offset + BATCH_SIZE - 1)];
                case 2:
                    _a = _c.sent(), cards = _a.data, error = _a.error;
                    if (error)
                        throw error;
                    if (!cards || cards.length === 0)
                        return [3 /*break*/, 11];
                    console.log("Fetched ".concat(cards.length, " cards (offset ").concat(offset, ")"));
                    _i = 0, cards_1 = cards;
                    _c.label = 3;
                case 3:
                    if (!(_i < cards_1.length)) return [3 /*break*/, 9];
                    card = cards_1[_i];
                    return [4 /*yield*/, supabase
                            .from("card_embeddings")
                            .select("card_id")
                            .eq("card_id", card.id)
                            .maybeSingle()];
                case 4:
                    _b = _c.sent(), existing = _b.data, exErr = _b.error;
                    if (exErr)
                        throw exErr;
                    if (existing) {
                        return [3 /*break*/, 8];
                    }
                    input = buildCardText(card);
                    return [4 /*yield*/, embedText(input)];
                case 5:
                    embedding = _c.sent();
                    return [4 /*yield*/, supabase
                            .from("card_embeddings")
                            .upsert({ card_id: card.id, embedding: embedding })];
                case 6:
                    upErr = (_c.sent()).error;
                    if (upErr)
                        throw upErr;
                    console.log("Embedded card ".concat(card.id, " - ").concat(card.name));
                    return [4 /*yield*/, sleep(SLEEP_MS)];
                case 7:
                    _c.sent();
                    _c.label = 8;
                case 8:
                    _i++;
                    return [3 /*break*/, 3];
                case 9:
                    offset += cards.length;
                    if (cards.length < BATCH_SIZE)
                        return [3 /*break*/, 11];
                    _c.label = 10;
                case 10: return [3 /*break*/, 1];
                case 11:
                    console.log("Finished card embeddings");
                    return [2 /*return*/];
            }
        });
    });
}
function embedArchetypes() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, archetypes, error, _i, archetypes_1, arch, text, embedding, upErr;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log("Embedding archetypes…");
                    return [4 /*yield*/, supabase
                            .from("archetypes")
                            .select("id, name, summary, embedding")];
                case 1:
                    _a = _b.sent(), archetypes = _a.data, error = _a.error;
                    if (error)
                        throw error;
                    if (!archetypes || archetypes.length === 0) {
                        console.log("No archetypes to embed");
                        return [2 /*return*/];
                    }
                    _i = 0, archetypes_1 = archetypes;
                    _b.label = 2;
                case 2:
                    if (!(_i < archetypes_1.length)) return [3 /*break*/, 7];
                    arch = archetypes_1[_i];
                    if (arch.embedding) {
                        return [3 /*break*/, 6];
                    }
                    text = arch.summary && arch.summary.length > 0
                        ? "".concat(arch.name, ": ").concat(arch.summary)
                        : arch.name;
                    return [4 /*yield*/, embedText(text)];
                case 3:
                    embedding = _b.sent();
                    return [4 /*yield*/, supabase
                            .from("archetypes")
                            .update({ embedding: embedding })
                            .eq("id", arch.id)];
                case 4:
                    upErr = (_b.sent()).error;
                    if (upErr)
                        throw upErr;
                    console.log("Embedded archetype ".concat(arch.name));
                    return [4 /*yield*/, sleep(SLEEP_MS)];
                case 5:
                    _b.sent();
                    _b.label = 6;
                case 6:
                    _i++;
                    return [3 /*break*/, 2];
                case 7:
                    console.log("Finished archetype embeddings");
                    return [2 /*return*/];
            }
        });
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, embedCards()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, embedArchetypes()];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    e_1 = _a.sent();
                    console.error(e_1);
                    process.exit(1);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
main();
