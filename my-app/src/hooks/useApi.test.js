import { act, renderHook, waitFor } from "@testing-library/react";
import { useApi } from "./useApi";

test("an obsolete request cannot replace the current page", async () => {
  let finishOld;
  const old = new Promise(resolve => { finishOld = resolve; });
  const { result, rerender } = renderHook(({ page }) => useApi(
    () => page === 0 ? old : Promise.resolve({ page }), { deps: [page] }
  ), { initialProps: { page: 0 } });
  rerender({ page: 1 });
  await waitFor(() => expect(result.current.data).toEqual({ page: 1 }));
  await act(async () => { finishOld({ page: 0 }); await old; });
  expect(result.current.data).toEqual({ page: 1 });
  expect(result.current.loading).toBe(false);
});

test("server data is immediately visible while revalidating", async () => {
  const initialData = { title: "Stored story" };
  let finish;
  const response = new Promise(resolve => { finish = resolve; });
  const { result } = renderHook(() => useApi(() => response, { initialData }));
  expect(result.current.data).toEqual(initialData);
  expect(result.current.loading).toBe(false);
  await act(async () => { finish({ title: "Fresh story" }); await response; });
  expect(result.current.data.title).toBe("Fresh story");
});

test("retry clears the error and exposes loading until the request completes", async () => {
  let finish;
  const response = new Promise(resolve => { finish = resolve; });
  const fetcher = jest.fn().mockRejectedValueOnce(new Error("offline")).mockReturnValueOnce(response);
  const { result } = renderHook(() => useApi(fetcher));
  await waitFor(() => expect(result.current.error).not.toBeNull());
  act(() => { result.current.refetch(); });
  expect(result.current.loading).toBe(true);
  expect(result.current.error).toBeNull();
  await act(async () => { finish({ok:true}); await response; });
  expect(result.current.loading).toBe(false);
  expect(result.current.data).toEqual({ok:true});
});

test("a complete server snapshot is not replaced by an older API cache", () => {
  const initialData = { title: "Current story" };
  const fetcher = jest.fn();
  const { result } = renderHook(() => useApi(fetcher, { initialData, revalidate: false }));
  expect(result.current.data).toBe(initialData);
  expect(result.current.loading).toBe(false);
  expect(fetcher).not.toHaveBeenCalled();
});

test("returning to server data invalidates an outstanding filtered request", async () => {
  const initialData = {page:0};
  let finish;
  const pending = new Promise(resolve => { finish=resolve; });
  const {result,rerender}=renderHook(({page})=>useApi(()=>pending,{deps:[page],initialData:page===0 ? initialData : null,revalidate:false}),{initialProps:{page:1}});
  rerender({page:0});
  expect(result.current.data).toEqual({page:0});
  await act(async()=>{finish({page:1});await pending;});
  expect(result.current.data).toEqual({page:0});
});
