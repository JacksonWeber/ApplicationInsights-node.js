// import * as http from "http";
// import * as https from "https";
// import * as assert from "assert";
// import * as os from "os";
// import * as fs from "fs";
// import * as sinon from "sinon";
// import * as events from "events";
// import { EventEmitter } from "events";
// import * as child_process from "child_process";
// import * as nock from "nock";

// import * as AppInsights from "../../src/applicationinsights";
// import * as Constants from "../../src/declarations/constants";
// import * as Contracts from "../../src/declarations/contracts";
// import { HeartBeat } from "../../src/library/heartBeat";
// import { TelemetryClient } from "../../src/library";
// import { Util } from "../../src/library/util";
// import { JsonConfig } from "../../src/library/configuration";
// import * as FileSystemHelper from "../../src/library/util";

// /**
//  * A fake response class that passes by default
//  */
// class fakeResponse {
//     private callbacks: { [event: string]: (data?: any) => void } = Object.create(null);
//     public setEncoding(): void {}
//     public statusCode: number = 200;
//     private _responseData: any;

//     constructor(private passImmediately: boolean = true, responseData?: any) {
//         this._responseData = responseData ? responseData : "data";
//     }

//     public on(event: string, callback: () => void) {
//         if (!this.callbacks[event]) {
//             this.callbacks[event] = callback;
//         } else {
//             var lastCallback = this.callbacks[event];
//             this.callbacks[event] = () => {
//                 callback();
//                 lastCallback();
//             };
//         }

//         if (event == "end" && this.passImmediately) {
//             this.pass(true);
//         }
//     }

//     public emit(eventName: string, ...args: any[]): boolean {
//         return true;
//     }

//     public addListener(eventName: string, listener: () => void): void {
//         this.on(eventName, listener);
//     }

//     public removeListener(eventName: string, listener: () => void) {}

//     public pass(test = false): void {
//         this.callbacks["data"] ? this.callbacks["data"](this._responseData) : null;
//         this.callbacks["end"] ? this.callbacks["end"]() : null;
//         this.callbacks["finish"] ? this.callbacks["finish"]() : null;
//     }

//     public end = this.pass;
//     public once = this.on;
// }

// /**
//  * A fake request class that fails by default
//  */
// class fakeRequest {
//     private callbacks: { [event: string]: Function } = Object.create(null);
//     public write(): void {}
//     public headers: { [id: string]: string } = {};
//     public agent = { protocol: "http" };
//     private _responseData: any;

//     constructor(
//         private failImmediatly: boolean = true,
//         public url: string = undefined,
//         responseData?: any
//     ) {
//         this._responseData = responseData;
//     }

//     public on(event: string, callback: Function) {
//         this.callbacks[event] = callback;
//         if (event === "error" && this.failImmediatly) {
//             setImmediate(() => this.fail());
//         }
//     }

//     public emit(eventName: string, ...args: any[]): boolean {
//         return true;
//     }

//     public addListener(eventName: string, listener: Function): void {
//         this.on(eventName, listener);
//     }

//     public removeListener(eventName: string, listener?: Function) {}

//     public fail(): void {
//         this.callbacks["error"] ? this.callbacks["error"]() : null;
//     }

//     public end(): void {
//         this.callbacks["end"]
//             ? this.callbacks["end"](new fakeResponse(true, this._responseData))
//             : null;
//     }
// }

// /**
//  * A fake http server
//  */
// class fakeHttpServer extends events.EventEmitter {
//     public setCallback(callback: any) {
//         this.on("request", callback);
//     }

//     public listen(port: any, host?: any, backlog?: any, callback?: any) {
//         this.emit("listening");
//     }

//     public emitRequest(url: string) {
//         var request = new fakeRequest(false, url);
//         var response = new fakeResponse(false);
//         this.emit("request", request, response);
//         request.end();
//     }
// }

// /**
//  * A fake https server class that doesn't require ssl certs
//  */
// class fakeHttpsServer extends events.EventEmitter {
//     public setCallback(callback: any) {
//         this.on("request", callback);
//     }

//     public listen(port: any, host?: any, backlog?: any, callback?: any) {
//         this.emit("listening");
//     }

//     public emitRequest(url: string) {
//         var request = new fakeRequest(false, url);
//         var response = new fakeResponse(false);
//         this.emit("request", request, response);
//         request.end();
//         response.pass();
//     }
// }

// describe("EndToEnd", () => {
//     var sandbox: sinon.SinonSandbox;
//     var originalEnv = {};
//     let interceptor: nock.Interceptor;

//     var breezeResponse: Contracts.BreezeResponse = {
//         itemsAccepted: 1,
//         itemsReceived: 1,
//         errors: [],
//     };

//     before(() => {
//         sandbox = sinon.createSandbox();
//         var newEnv = <{ [id: string]: string }>{};
//         Util.getInstance().tlsRestrictedAgent = new https.Agent();
//         newEnv["APPLICATION_INSIGHTS_NO_STATSBEAT"] = "true";
//         newEnv["TMP"] = process.env.TMP;
//         newEnv["TMPDIR"] = process.env.TMPDIR;
//         newEnv["TEMP"] = process.env.TEMP;
//         originalEnv = process.env;
//         process.env = newEnv;

//         interceptor = nock(Constants.DEFAULT_BREEZE_ENDPOINT).post(
//             "/v2.1/track",
//             (body: string) => {
//                 return true;
//             }
//         );
//         nock.disableNetConnect();
//     });

//     after(() => {
//         process.env = originalEnv;
//         nock.cleanAll();
//         nock.enableNetConnect();
//     });

//     describe("Basic usage", () => {
//         let nockScope: nock.Scope;

//         before(() => {
//             nockScope = interceptor.reply(200, breezeResponse).persist();
//         });

//         beforeEach(() => {
//             JsonConfig["_instance"] = undefined;
//         });

//         afterEach(() => {
//             // Dispose the default app insights client and auto collectors so that they can be reconfigured
//             // cleanly for each test
//             sandbox.restore();
//             // TODO: Correlation management pending work
//             // CorrelationContextManager.reset();
//             AppInsights.dispose();
//         });

//         it("should send telemetry", (done) => {
//             const expectedTelemetryData: AppInsights.Contracts.AvailabilityTelemetry = {
//                 duration: 100,
//                 id: "id1",
//                 message: "message1",
//                 success: true,
//                 name: "name1",
//                 runLocation: "east us",
//             };

//             var client = new AppInsights.TelemetryClient("iKey");

//             client.trackEvent({ name: "test event" });
//             client.trackException({ exception: new Error("test error") });
//             client.trackMetric({ metrics: [{ name: "test metric", value: 3 }] });
//             client.trackTrace({ message: "test trace" });
//             client.trackAvailability(expectedTelemetryData);

//             client.flush({
//                 callback: (response) => {
//                     assert.ok(response, "response should not be empty");
//                     assert.ok(response !== "no data to send", "response should have data");
//                     done();
//                 },
//             });
//         });

//         it("should collect http request telemetry", (done) => {
//             var fakeHttpSrv = new fakeHttpServer();
//             sandbox
//                 .stub(http, "createServer")
//                 .callsFake(
//                     (callback: (req: http.ServerRequest, res: http.ServerResponse) => void) => {
//                         fakeHttpSrv.setCallback(callback);
//                         return fakeHttpSrv as any;
//                     }
//                 );

//             AppInsights.setup("ikey").setAutoCollectRequests(true).start();

//             var track = sandbox.stub(AppInsights.defaultClient, "track");
//             http.createServer((req, res) => {
//                 assert.equal(track.callCount, 0);
//                 res.end();
//                 assert.equal(track.callCount, 1);
//                 done();
//             });

//             fakeHttpSrv.emitRequest("http://localhost:0/test");
//         });

//         it("should collect https request telemetry", (done) => {
//             var fakeHttpSrv = new fakeHttpServer();
//             sandbox
//                 .stub(https, "createServer")
//                 .callsFake(
//                     (
//                         options: any,
//                         callback: (req: http.ServerRequest, res: http.ServerResponse) => void
//                     ) => {
//                         fakeHttpSrv.setCallback(callback);
//                         return fakeHttpSrv as any;
//                     }
//                 );

//             AppInsights.setup("ikey").setAutoCollectRequests(true).start();

//             var track = sandbox.stub(AppInsights.defaultClient, "track");
//             https.createServer(null, (req: http.ServerRequest, res: http.ServerResponse) => {
//                 assert.equal(track.callCount, 0);
//                 res.end();
//                 assert.equal(track.callCount, 1);
//                 done();
//             });

//             fakeHttpSrv.emitRequest("http://localhost:0/test");
//         });

//         it("should collect http dependency telemetry", (done) => {
//             var eventEmitter = new EventEmitter();
//             (<any>eventEmitter).method = "GET";
//             sandbox.stub(http, "request").callsFake((url: string, c: Function) => {
//                 process.nextTick(c);
//                 return eventEmitter as any;
//             });

//             AppInsights.setup("ikey").setAutoCollectDependencies(true).start();

//             var track = sandbox.stub(AppInsights.defaultClient, "track");

//             http.request(<any>"http://test.com", (c) => {
//                 assert.equal(track.callCount, 0);
//                 eventEmitter.emit("response", {});
//                 assert.equal(track.callCount, 1);
//                 done();
//             });
//         });

//         it("should collect https dependency telemetry", (done) => {
//             sandbox.restore();
//             var eventEmitter = new EventEmitter();
//             (<any>eventEmitter).method = "GET";
//             sandbox.stub(https, "request").callsFake((url: string, c: Function) => {
//                 process.nextTick(c);
//                 return eventEmitter as any;
//             });

//             AppInsights.setup("ikey").setAutoCollectDependencies(true).start();

//             var track = sandbox.stub(AppInsights.defaultClient, "track");

//             https.request(<any>"https://test.com", (c) => {
//                 assert.equal(track.callCount, 0);
//                 eventEmitter.emit("response", {});
//                 assert.equal(track.callCount, 1);
//                 done();
//             });
//         });

//         it("should add correlation context if not available", (done) => {
//             var eventEmitter = new EventEmitter();
//             (<any>eventEmitter).method = "GET";
//             sandbox.stub(http, "request").callsFake((url: string, c: Function) => {
//                 process.nextTick(c);
//                 return eventEmitter as any;
//             });

//             // TODO: Correlation Context implementation
//             // let generateContextSpy = sandbox.spy(CorrelationContextManager, "generateContextObject");
//             // AppInsights
//             //     .setup("ikey")
//             //     .setAutoCollectDependencies(true)
//             //     .setAutoDependencyCorrelation(true);
//             // AppInsights.start();
//             // sandbox.stub(AppInsights.defaultClient, 'track');

//             // http.request(<any>'http://test.com', (c) => {
//             //     assert.equal(generateContextSpy.callCount, 1);
//             //     done();
//             // });
//         });
//     });

//     describe("W3C mode", () => {
//         let nockScope: nock.Scope;

//         before(() => {
//             nockScope = interceptor.reply(200, breezeResponse).persist();
//         });

//         beforeEach(() => {
//             JsonConfig["_instance"] = undefined;
//         });

//         afterEach(() => {
//             // Dispose the default app insights client and auto collectors so that they can be reconfigured
//             // cleanly for each test
//             sandbox.restore();
//             // TODO: Correlation management pending work
//             // CorrelationContextManager.reset();
//             AppInsights.dispose();
//         });

//         it("should pass along traceparent/tracestate header if present in current operation", (done) => {
//             var eventEmitter = new EventEmitter();
//             (eventEmitter as any).headers = {};
//             (eventEmitter as any)["getHeader"] = function (name: string) {
//                 return this.headers[name];
//             };
//             (eventEmitter as any)["setHeader"] = function (name: string, value: string) {
//                 this.headers[name] = value;
//             };
//             (<any>eventEmitter).method = "GET";
//             sandbox.stub(https, "request").callsFake((url: string, c: Function) => {
//                 process.nextTick(c);
//                 return eventEmitter as any;
//             });

//             AppInsights.setup("ikey").setAutoCollectDependencies(true).start();

//             // TODO: Correlation Context implementation
//             // sandbox.stub(CorrelationContextManager, "getCurrentContext").callsFake(() => ({
//             //     operation: {
//             //         traceparent: "",
//             //         tracestate: "sometracestate"
//             //     },
//             //     customProperties: {
//             //         serializeToHeader: (): null => null
//             //     }
//             // }));
//             https.request(<any>"https://test.com", (c) => {
//                 eventEmitter.emit("response", {});
//                 assert.ok(
//                     (eventEmitter as any).headers["request-id"].match(/^\|[0-z]{32}\.[0-z]{16}\./g)
//                 );
//                 assert.ok(
//                     (eventEmitter as any).headers.traceparent.match(
//                         /^00-5e84aff3af474588a42dcbf3bd1db95f-[0-z]{16}-00$/
//                     )
//                 );
//                 assert.notEqual(
//                     (eventEmitter as any).headers.traceparent,
//                     "00-5e84aff3af474588a42dcbf3bd1db95f-1fc066fb77fa43a3-00"
//                 );
//                 assert.equal((eventEmitter as any).headers.tracestate, "sometracestate");
//                 AppInsights.defaultClient.flush();
//                 done();
//             });
//         });

//         it("should create and pass a traceparent header if w3c is enabled", (done) => {
//             var eventEmitter = new EventEmitter();
//             (eventEmitter as any).headers = {};
//             (eventEmitter as any)["getHeader"] = function (name: string) {
//                 return this.headers[name];
//             };
//             (eventEmitter as any)["setHeader"] = function (name: string, value: string) {
//                 this.headers[name] = value;
//             };
//             (<any>eventEmitter).method = "GET";
//             sandbox.stub(https, "request").callsFake((url: string, c: Function) => {
//                 process.nextTick(c);
//                 return eventEmitter as any;
//             });
//             AppInsights.setup("ikey").setAutoCollectDependencies(true).start();

//             // TODO: Correlation Context implementation
//             // sandbox.stub(CorrelationContextManager, "getCurrentContext").callsFake(() => ({
//             //     operation: {
//             //     },
//             //     customProperties: {
//             //         serializeToHeader: (): null => null
//             //     }
//             // }));
//             https.request(<any>"https://test.com", (c) => {
//                 eventEmitter.emit("response", {});
//                 assert.ok(
//                     (eventEmitter as any).headers.traceparent.match(
//                         /^00-[0-z]{32}-[0-z]{16}-[0-9a-f]{2}/g
//                     ),
//                     "traceparent header is passed, 00-W3C-W3C-00"
//                 );
//                 assert.ok(
//                     (eventEmitter as any).headers["request-id"].match(/^\|[0-z]{32}\.[0-z]{16}\./g),
//                     "back compat header is also passed, |W3C.W3C." +
//                         (eventEmitter as any).headers["request-id"]
//                 );
//                 AppInsights.defaultClient.flush();
//                 done();
//             });
//         });
//     });

//     describe("Disk retry mode", () => {
//         var writeFile: sinon.SinonStub;
//         var writeFileSync: sinon.SinonStub;
//         var readFile: sinon.SinonStub;
//         var lstat: sinon.SinonStub;
//         var mkdir: sinon.SinonStub;
//         var existsSync: sinon.SinonStub;
//         var readdir: sinon.SinonStub;
//         var readdirSync: sinon.SinonStub;
//         var stat: sinon.SinonStub;
//         var statSync: sinon.SinonStub;
//         var mkdirSync: sinon.SinonStub;
//         var spawn: sinon.SinonStub;
//         var spawnSync: sinon.SinonStub;

//         let nockScope: nock.Scope;

//         beforeEach(() => {
//             nockScope = interceptor.reply(503, { errors: [{ index: 0, statusCode: 503 }] });
//             AppInsights.dispose();
//             writeFile = sandbox.stub(FileSystemHelper, "writeFileAsync");
//             writeFileSync = sandbox.stub(fs, "writeFileSync");
//             existsSync = sandbox.stub(fs, "existsSync").value(true);
//             readdir = sandbox.stub(FileSystemHelper, "readdirAsync").value(["1.ai.json"]);
//             readdirSync = sandbox.stub(fs, "readdirSync").value(["1.ai.json"]);
//             stat = sandbox
//                 .stub(FileSystemHelper, "statAsync")
//                 .value({ isFile: () => true, size: 8000 });
//             statSync = sandbox.stub(fs, "statSync").value({ isFile: () => true, size: 8000 });
//             lstat = sandbox.stub(FileSystemHelper, "lstatAsync").value({ isDirectory: () => true });
//             mkdir = sandbox.stub(FileSystemHelper, "mkdirAsync").value(null);
//             mkdirSync = sandbox.stub(fs, "mkdirSync").value(null);
//             readFile = sandbox.stub(FileSystemHelper, "readFileAsync").value("");
//             spawn = sandbox.stub(child_process, "spawn").value({
//                 on: (type: string, cb: any) => {
//                     if (type === "close") {
//                         cb(0);
//                     }
//                 },
//                 stdout: {
//                     on: (type: string, cb: any) => {
//                         if (type === "data") {
//                             cb("stdoutmock");
//                         }
//                     },
//                 },
//             });
//             if (child_process.spawnSync) {
//                 spawnSync = sandbox
//                     .stub(child_process, "spawnSync")
//                     .value({ status: 0, stdout: "stdoutmock" });
//             }
//             JsonConfig["_instance"] = undefined;
//         });

//         afterEach(() => {
//             sandbox.restore();
//             AppInsights.dispose();
//         });

//         it("disabled by default for new clients", (done) => {
//             var client = new AppInsights.TelemetryClient("key");
//             client.trackEvent({ name: "test event" });

//             client.flush({
//                 callback: (response: any) => {
//                     // yield for the caching behavior
//                     setImmediate(() => {
//                         assert(writeFile.callCount === 0);
//                         done();
//                     });
//                 },
//             });
//         });

//         it("enabled by default for default client", (done) => {
//             AppInsights.setup("key").start();
//             var client = AppInsights.defaultClient;
//             client.trackEvent({ name: "test event" });
//             client.flush({
//                 callback: (response: any) => {
//                     // yield for the caching behavior
//                     setImmediate(() => {
//                         assert.equal(writeFile.callCount, 1);
//                         done();
//                     });
//                 },
//             });
//         });

//         it("cache payload synchronously when process crashes", () => {
//             var client = new AppInsights.TelemetryClient("key2");
//             // TODO: Persistance is not configurable in Exporter
//             //client.channel.setUseDiskRetryCaching(true);

//             client.trackEvent({ name: "test event" });
//             client.flush({ isAppCrashing: true });

//             assert(existsSync.callCount === 1);
//             assert(writeFileSync.callCount === 1);
//             assert.equal(spawnSync.callCount, os.type() === "Windows_NT" ? 1 : 0); // This is implicitly testing caching of ACL identity (otherwise call count would be 2 like it is the non-sync time)
//             // TODO: This test should validate external persist is called only
//             // assert.equal(
//             //     path.dirname(writeFileSync.firstCall.args[0]),
//             //     path.join(os.tmpdir(), Sender.TEMPDIR_PREFIX + "key2"));
//             // assert.equal(writeFileSync.firstCall.args[2].mode, 0o600, "File must not have weak permissions");
//         });
//     });

//     describe("Heartbeat metrics for VM", () => {
//         beforeEach(() => {
//             JsonConfig["_instance"] = undefined;
//         });

//         afterEach(() => {
//             sandbox.restore();
//         });

//         it("should collect correct VM information from JSON response", (done) => {
//             // set up stub
//             const vmDataJSON = `{
//                 "vmId": "1",
//                 "subscriptionId": "2",
//                 "osType": "Windows_NT"
//             }`;
//             let func = (options: any, callback: any) => {
//                 var req = new fakeRequest(false, "http://169.254.169.254", vmDataJSON);
//                 req.on("end", callback);
//                 return req as any;
//             };
//             var stub: sinon.SinonStub = sandbox.stub(http, "request").callsFake(func);

//             // set up sdk
//             const client = new TelemetryClient("key");
//             const heartbeat: HeartBeat = new HeartBeat(client.metricHandler, client.config);
//             heartbeat.enable(true);
//             const trackMetricStub = sandbox.stub(heartbeat["_handler"], "trackMetric");

//             heartbeat["trackHeartBeat"](client.config, () => {
//                 assert.equal(
//                     trackMetricStub.callCount,
//                     1,
//                     "should call trackMetric for the VM heartbeat metric"
//                 );
//                 assert.equal(
//                     trackMetricStub.args[0][0].metrics[0].name,
//                     "HeartBeat",
//                     "should use correct name for heartbeat metric"
//                 );
//                 assert.equal(trackMetricStub.args[0][0].metrics[0].value, 0, "value should be 0");
//                 const keys = Object.keys(trackMetricStub.args[0][0].properties);
//                 assert.equal(
//                     keys.length,
//                     5,
//                     "should have 4 kv pairs added when resource type is VM"
//                 );
//                 assert.equal(keys[0], "sdk", "sdk should be added as a key");
//                 assert.equal(keys[1], "osType", "osType should be added as a key");
//                 assert.equal(keys[2], "azInst_vmId", "azInst_vmId should be added as a key");
//                 assert.equal(
//                     keys[3],
//                     "azInst_subscriptionId",
//                     "azInst_subscriptionId should be added as a key"
//                 );
//                 assert.equal(keys[4], "azInst_osType", "azInst_osType should be added as a key");

//                 const properties = trackMetricStub.args[0][0].properties;
//                 assert.equal(
//                     properties["sdk"],
//                     heartbeat["_handler"].getContext().sdkVersion,
//                     "sdk version should be read from Context"
//                 );
//                 assert.equal(
//                     properties["osType"],
//                     os.type(),
//                     "osType should be read from os library"
//                 );
//                 assert.equal(
//                     properties["azInst_vmId"],
//                     "1",
//                     "azInst_vmId should be read from response"
//                 );
//                 assert.equal(
//                     properties["azInst_subscriptionId"],
//                     "2",
//                     "azInst_subscriptionId should be read from response"
//                 );
//                 assert.equal(
//                     properties["azInst_osType"],
//                     "Windows_NT",
//                     "azInst_osType should be read from response"
//                 );
//                 done();
//             });
//         });

//         it("should only send name and value properties for heartbeat metric when get VM request fails", (done) => {
//             // set up stub
//             var stub: sinon.SinonStub = sandbox
//                 .stub(http, "request")
//                 .callsFake((options: any, callback: any) => {
//                     var req = new fakeRequest(true, "http://169.254.169.254");
//                     return req as any;
//                 });

//             // set up sdk
//             const client = new TelemetryClient("key");
//             const heartbeat: HeartBeat = new HeartBeat(client.metricHandler, client.config);
//             heartbeat.enable(true);
//             const trackMetricStub = sandbox.stub(heartbeat["_handler"], "trackMetric");

//             heartbeat["trackHeartBeat"](client.config, () => {
//                 assert.equal(
//                     trackMetricStub.callCount,
//                     1,
//                     "should call trackMetric as heartbeat metric"
//                 );
//                 assert.equal(
//                     trackMetricStub.args[0][0].metrics[0].name,
//                     "HeartBeat",
//                     "should use correct name for heartbeat metric"
//                 );
//                 assert.equal(trackMetricStub.args[0][0].metrics[0].value, 0, "value should be 0");
//                 const keys = Object.keys(trackMetricStub.args[0][0].properties);
//                 assert.equal(
//                     keys.length,
//                     2,
//                     "should have 2 kv pairs added when resource type is not web app, not function app, not VM"
//                 );
//                 assert.equal(keys[0], "sdk", "sdk should be added as a key");
//                 assert.equal(keys[1], "osType", "osType should be added as a key");

//                 const properties = trackMetricStub.args[0][0].properties;
//                 assert.equal(
//                     properties["sdk"],
//                     heartbeat["_handler"].getContext().sdkVersion,
//                     "sdk version should be read from Context"
//                 );
//                 assert.equal(
//                     properties["osType"],
//                     os.type(),
//                     "osType should be read from os library"
//                 );
//                 done();
//             });
//         });
//     });
// });
