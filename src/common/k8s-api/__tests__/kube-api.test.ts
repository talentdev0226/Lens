/**
 * Copyright (c) 2021 OpenLens Authors
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import type { Request } from "node-fetch";
import { forRemoteCluster, KubeApi } from "../kube-api";
import { KubeJsonApi } from "../kube-json-api";
import { KubeObject } from "../kube-object";
import AbortController from "abort-controller";
import { delay } from "../../utils/delay";

class TestKubeObject extends KubeObject {
  static kind = "Pod";
  static namespaced = true;
  static apiBase = "/api/v1/pods";
}

class TestKubeApi extends KubeApi<TestKubeObject> {}

describe("forRemoteCluster", () => {
  it("builds api client for KubeObject", async () => {
    const api = forRemoteCluster({
      cluster: {
        server: "https://127.0.0.1:6443",
      },
      user: {
        token: "daa",
      },
    }, TestKubeObject);

    expect(api).toBeInstanceOf(KubeApi);
  });

  it("builds api client for given KubeApi", async () => {
    const api = forRemoteCluster({
      cluster: {
        server: "https://127.0.0.1:6443",
      },
      user: {
        token: "daa",
      },
    }, TestKubeObject, TestKubeApi);

    expect(api).toBeInstanceOf(TestKubeApi);
  });

  it("calls right api endpoint", async () => {
    const api = forRemoteCluster({
      cluster: {
        server: "https://127.0.0.1:6443",
      },
      user: {
        token: "daa",
      },
    }, TestKubeObject);

    (fetch as any).mockResponse(async (request: any) => {
      expect(request.url).toEqual("https://127.0.0.1:6443/api/v1/pods");

      return {
        body: "hello",
      };
    });

    expect.hasAssertions();

    await api.list();
  });
});

describe("KubeApi", () => {
  let request: KubeJsonApi;

  beforeEach(() => {
    request = new KubeJsonApi({
      serverAddress: `http://127.0.0.1:9999`,
      apiBase: "/api-kube",
    });
  });

  it("uses url from apiBase if apiBase contains the resource", async () => {
    (fetch as any).mockResponse(async (request: any) => {
      if (request.url === "http://127.0.0.1:9999/api-kube/apis/networking.k8s.io/v1") {
        return {
          body: JSON.stringify({
            resources: [{
              name: "ingresses",
            }] as any[],
          }),
        };
      } else if (request.url === "http://127.0.0.1:9999/api-kube/apis/extensions/v1beta1") {
        // Even if the old API contains ingresses, KubeApi should prefer the apiBase url
        return {
          body: JSON.stringify({
            resources: [{
              name: "ingresses",
            }] as any[],
          }),
        };
      } else {
        return {
          body: JSON.stringify({
            resources: [] as any[],
          }),
        };
      }
    });

    const apiBase = "/apis/networking.k8s.io/v1/ingresses";
    const fallbackApiBase = "/apis/extensions/v1beta1/ingresses";
    const kubeApi = new KubeApi({
      request,
      objectConstructor: KubeObject,
      apiBase,
      fallbackApiBases: [fallbackApiBase],
      checkPreferredVersion: true,
    });

    await kubeApi.get({
      name: "foo",
      namespace: "default",
    });
    expect(kubeApi.apiPrefix).toEqual("/apis");
    expect(kubeApi.apiGroup).toEqual("networking.k8s.io");
  });

  it("uses url from fallbackApiBases if apiBase lacks the resource", async () => {
    (fetch as any).mockResponse(async (request: any) => {
      if (request.url === "http://127.0.0.1:9999/api-kube/apis/networking.k8s.io/v1") {
        return {
          body: JSON.stringify({
            resources: [] as any[],
          }),
        };
      } else if (request.url === "http://127.0.0.1:9999/api-kube/apis/extensions/v1beta1") {
        return {
          body: JSON.stringify({
            resources: [{
              name: "ingresses",
            }] as any[],
          }),
        };
      } else {
        return {
          body: JSON.stringify({
            resources: [] as any[],
          }),
        };
      }
    });

    const apiBase = "apis/networking.k8s.io/v1/ingresses";
    const fallbackApiBase = "/apis/extensions/v1beta1/ingresses";
    const kubeApi = new KubeApi({
      request,
      objectConstructor: KubeObject,
      apiBase,
      fallbackApiBases: [fallbackApiBase],
      checkPreferredVersion: true,
    });

    await kubeApi.get({
      name: "foo",
      namespace: "default",
    });
    expect(kubeApi.apiPrefix).toEqual("/apis");
    expect(kubeApi.apiGroup).toEqual("extensions");
  });

  describe("patch", () => {
    let api: TestKubeApi;

    beforeEach(() => {
      api = new TestKubeApi({
        request,
        objectConstructor: TestKubeObject,
      });
    });

    it("sends strategic patch by default", async () => {
      expect.hasAssertions();

      (fetch as any).mockResponse(async (request: Request) => {
        expect(request.method).toEqual("PATCH");
        expect(request.headers.get("content-type")).toMatch("strategic-merge-patch");
        expect(request.body.toString()).toEqual(JSON.stringify({ spec: { replicas: 2 }}));

        return {};
      });

      await api.patch({ name: "test", namespace: "default" }, {
        spec: { replicas: 2 },
      });
    });

    it("allows to use merge patch", async () => {
      expect.hasAssertions();

      (fetch as any).mockResponse(async (request: Request) => {
        expect(request.method).toEqual("PATCH");
        expect(request.headers.get("content-type")).toMatch("merge-patch");
        expect(request.body.toString()).toEqual(JSON.stringify({ spec: { replicas: 2 }}));

        return {};
      });

      await api.patch({ name: "test", namespace: "default" }, {
        spec: { replicas: 2 },
      }, "merge");
    });

    it("allows to use json patch", async () => {
      expect.hasAssertions();

      (fetch as any).mockResponse(async (request: Request) => {
        expect(request.method).toEqual("PATCH");
        expect(request.headers.get("content-type")).toMatch("json-patch");
        expect(request.body.toString()).toEqual(JSON.stringify([{ op: "replace", path: "/spec/replicas", value: 2 }]));

        return {};
      });

      await api.patch({ name: "test", namespace: "default" }, [
        { op: "replace", path: "/spec/replicas", value: 2 },
      ], "json");
    });
  });

  describe("delete", () => {
    let api: TestKubeApi;

    beforeEach(() => {
      api = new TestKubeApi({
        request,
        objectConstructor: TestKubeObject,
      });
    });

    it("sends correct request with empty namespace", async () => {
      expect.hasAssertions();
      (fetch as any).mockResponse(async (request: Request) => {
        expect(request.method).toEqual("DELETE");
        expect(request.url).toEqual("http://127.0.0.1:9999/api-kube/api/v1/pods/foo?propagationPolicy=Background");

        return {};
      });

      await api.delete({ name: "foo", namespace: "" });
    });

    it("sends correct request without namespace", async () => {
      expect.hasAssertions();
      (fetch as any).mockResponse(async (request: Request) => {
        expect(request.method).toEqual("DELETE");
        expect(request.url).toEqual("http://127.0.0.1:9999/api-kube/api/v1/namespaces/default/pods/foo?propagationPolicy=Background");

        return {};
      });

      await api.delete({ name: "foo" });
    });

    it("sends correct request with namespace", async () => {
      expect.hasAssertions();
      (fetch as any).mockResponse(async (request: Request) => {
        expect(request.method).toEqual("DELETE");
        expect(request.url).toEqual("http://127.0.0.1:9999/api-kube/api/v1/namespaces/kube-system/pods/foo?propagationPolicy=Background");

        return {};
      });

      await api.delete({ name: "foo", namespace: "kube-system" });
    });

    it("allows to change propagationPolicy", async () => {
      expect.hasAssertions();
      (fetch as any).mockResponse(async (request: Request) => {
        expect(request.method).toEqual("DELETE");
        expect(request.url).toMatch("propagationPolicy=Orphan");

        return {};
      });

      await api.delete({ name: "foo", namespace: "default", propagationPolicy: "Orphan" });
    });
  });

  describe("watch", () => {
    let api: TestKubeApi;

    beforeEach(() => {
      api = new TestKubeApi({
        request,
        objectConstructor: TestKubeObject,
      });
    });

    it("sends a valid watch request", () => {
      const spy = jest.spyOn(request, "getResponse");

      (fetch as any).mockResponse(async () => {
        return {};
      });

      api.watch({ namespace: "kube-system" });
      expect(spy).toHaveBeenCalledWith("/api/v1/namespaces/kube-system/pods?watch=1&resourceVersion=", expect.anything(), expect.anything());
    });

    it("sends timeout as a query parameter", async () => {
      const spy = jest.spyOn(request, "getResponse");

      (fetch as any).mockResponse(async () => {
        return {};
      });

      api.watch({ namespace: "kube-system", timeout: 60 });
      expect(spy).toHaveBeenCalledWith("/api/v1/namespaces/kube-system/pods?watch=1&resourceVersion=", { query: { timeoutSeconds: 60 }}, expect.anything());
    });

    it("aborts watch using abortController", async (done) => {
      const spy = jest.spyOn(request, "getResponse");

      (fetch as any).mockResponse(async (request: Request) => {
        (request as any).signal.addEventListener("abort", () => {
          done();
        });

        return {};
      });

      const abortController = new AbortController();
      
      api.watch({
        namespace: "kube-system",
        timeout: 60,
        abortController,
      });

      expect(spy).toHaveBeenCalledWith("/api/v1/namespaces/kube-system/pods?watch=1&resourceVersion=", { query: { timeoutSeconds: 60 }}, expect.anything());

      await delay(100);

      abortController.abort();
    });

    describe("retries", () => {
      it("if request ended", (done) => {
        const spy = jest.spyOn(request, "getResponse");

        // we need to mock using jest as jest-fetch-mock doesn't support mocking the body completely
        jest.spyOn(global, "fetch").mockImplementation(async () => {
          return {
            ok: true,
            body: {
              on: (eventName: string, callback: Function) => {
                // End the request in 100ms.
                if (eventName === "end") {
                  setTimeout(() => {
                    callback();
                  }, 100);
                }
              },
            },
          } as any;
        });
      
        api.watch({
          namespace: "kube-system",
        });

        expect(spy).toHaveBeenCalledTimes(1);

        setTimeout(() => {  
          expect(spy).toHaveBeenCalledTimes(2);
          done();
        }, 2000);
      });

      it("if request not closed after timeout", (done) => {
        const spy = jest.spyOn(request, "getResponse");

        (fetch as any).mockResponse(async () => {
          return {};
        });

        const timeoutSeconds = 1;
      
        api.watch({
          namespace: "kube-system",
          timeout: timeoutSeconds,
        });

        expect(spy).toHaveBeenCalledTimes(1);

        setTimeout(() => {  
          expect(spy).toHaveBeenCalledTimes(2);
          done();
        }, timeoutSeconds * 1000 * 1.2);
      });

      it("retries only once if request ends and timeout is set", (done) => {
        const spy = jest.spyOn(request, "getResponse");

        // we need to mock using jest as jest-fetch-mock doesn't support mocking the body completely
        jest.spyOn(global, "fetch").mockImplementation(async () => {
          return {
            ok: true,
            body: {
              on: (eventName: string, callback: Function) => {
                // End the request in 100ms
                if (eventName === "end") {
                  setTimeout(() => {
                    callback();
                  }, 100);
                }
              },
            },
          } as any;
        });
      
        const timeoutSeconds = 0.5;
      
        api.watch({
          namespace: "kube-system",
          timeout: timeoutSeconds,
        });

        expect(spy).toHaveBeenCalledTimes(1);

        setTimeout(() => {  
          expect(spy).toHaveBeenCalledTimes(2);
          done();
        }, 2000);
      });

      afterEach(() => {
        jest.clearAllMocks();
      });
    });
  });
});
