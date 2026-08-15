import type { WebXRProbe } from "../ar/types";

type LandingProps = {
  probe: WebXRProbe | null;
  busy: boolean;
  sessionError: string | null;
  onStart: () => void;
};

export function Landing({ probe, busy, sessionError, onStart }: LandingProps) {
  const ready = Boolean(probe?.ready);
  const error = sessionError ?? probe?.blockingReason ?? null;

  return (
    <main className="landing">
      <div className="grain" aria-hidden="true" />
      <header className="landing-top">
        <span className="kicker">WebXR · ARCore</span>
        <StatusChip probe={probe} />
      </header>

      <section className="hero">
        <p className="eyebrow">Room scale · hit-test</p>
        <h1>AR RULER</h1>
        <p className="lede">Measure anything in your room.</p>
        <button
          type="button"
          className="start"
          onClick={onStart}
          disabled={!ready || busy}
        >
          {busy ? "Starting AR…" : "Start Measuring"}
        </button>
        <p className="disclaimer">AR measurements are approximate.</p>
        {error && <p className="error">{error}</p>}
      </section>

      <section className="checks" aria-live="polite">
        <h2>Device check</h2>
        <ul>
          <Check ok={probe?.secureContext} label="Secure context" detail="HTTPS or localhost" />
          <Check ok={probe?.xrInNavigator} label="WebXR API" detail="navigator.xr" />
          <Check ok={probe?.immersiveArSupported} label="immersive-ar" detail="real camera AR session" />
          <Check ok={probe?.isAndroid} label="Android" detail="Nothing Phone (2a) class device" />
          <Check ok={probe?.isChrome} label="Chrome" detail="not a camera overlay fallback" />
        </ul>
        <p className="footnote">
          This app starts a real <code>immersive-ar</code> session with WebXR hit-testing. If AR is
          unavailable, it will not pretend with a 2D camera feed.
        </p>
      </section>
    </main>
  );
}

function StatusChip({ probe }: { probe: WebXRProbe | null }) {
  if (!probe) {
    return <span className="chip wait">Checking WebXR…</span>;
  }
  if (probe.ready) {
    return <span className="chip ok">AR ready</span>;
  }
  return <span className="chip no">AR unavailable</span>;
}

function Check({
  ok,
  label,
  detail,
}: {
  ok: boolean | undefined;
  label: string;
  detail: string;
}) {
  const mark = ok === undefined ? "…" : ok ? "yes" : "no";
  return (
    <li className={ok ? "pass" : ok === false ? "fail" : "wait"}>
      <span>{label}</span>
      <b>{mark}</b>
      <small>{detail}</small>
    </li>
  );
}
