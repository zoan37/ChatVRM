import { useContext, useCallback, useState } from "react";
import { ViewerContext } from "../features/vrmViewer/viewerContext";
import { buildUrl } from "@/utils/buildUrl";

/**
 * Served from our own origin rather than a public IPFS gateway: those give no
 * availability guarantee and were returning 504s, which left the page with no
 * avatar at all.
 */
const DEFAULT_VRM_PATH = "/AvatarSample_B.vrm";

type LoadState =
  | { status: "loading"; percent: number }
  | { status: "loaded" }
  | { status: "error" };

export default function VrmViewer() {
  const { viewer } = useContext(ViewerContext);
  const [load, setLoad] = useState<LoadState>({ status: "loading", percent: 0 });

  const canvasRef = useCallback(
    (canvas: HTMLCanvasElement) => {
      if (canvas) {
        viewer.setup(canvas);

        const loadModel = (url: string) => {
          setLoad({ status: "loading", percent: 0 });
          viewer.loadVrm(url, {
            onProgress: (loaded, total) => {
              // `total` is 0 when the server sends no Content-Length.
              setLoad({
                status: "loading",
                percent: total > 0 ? Math.round((loaded / total) * 100) : 0,
              });
            },
            onLoad: () => setLoad({ status: "loaded" }),
            onError: () => setLoad({ status: "error" }),
          });
        };

        loadModel(buildUrl(DEFAULT_VRM_PATH));

        // Drag and DropでVRMを差し替え
        canvas.addEventListener("dragover", function (event) {
          event.preventDefault();
        });

        canvas.addEventListener("drop", function (event) {
          event.preventDefault();

          const files = event.dataTransfer?.files;
          if (!files) {
            return;
          }

          const file = files[0];
          if (!file) {
            return;
          }

          const file_type = file.name.split(".").pop();
          if (file_type === "vrm") {
            const blob = new Blob([file], { type: "application/octet-stream" });
            const url = window.URL.createObjectURL(blob);
            loadModel(url);
          }
        });
      }
    },
    [viewer]
  );

  return (
    <div className={"absolute top-0 left-0 w-screen h-[100svh] -z-10"}>
      <canvas ref={canvasRef} className={"h-full w-full"}></canvas>
      {load.status !== "loaded" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="px-24 py-16 rounded-8 bg-black/60 text-white text-center pointer-events-auto">
            {load.status === "loading" ? (
              <>
                <div className="typography-16">Loading avatar…</div>
                <div className="mt-8 w-full h-4 bg-white/25 rounded-4 overflow-hidden">
                  <div
                    className="h-full bg-white transition-[width] duration-200"
                    style={{ width: `${load.percent}%` }}
                  />
                </div>
                {load.percent > 0 && (
                  <div className="mt-4 typography-12 opacity-80">{load.percent}%</div>
                )}
              </>
            ) : (
              <div className="typography-16">
                Couldn&apos;t load the avatar. Check your connection and reload, or drag a
                .vrm file onto the page.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
