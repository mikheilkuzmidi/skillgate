import { Notice } from "@/components/Status";

export function ReadError({ retry }: { retry: () => unknown }) {
  return (
    <section className="sec">
      <Notice>Unable to read the current workspace. Check the connection and retry.</Notice>
      <button className="btn ghost sm" onClick={() => void retry()}>Retry</button>
    </section>
  );
}
