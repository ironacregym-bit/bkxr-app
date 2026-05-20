// File: pages/waitlist/thanks.tsx
import Head from from "next/link";import Head from "next/head";
import { useMemo } from "react";
import { useRouter } from "next/router";

function getStr(q: any): string {
  if (typeof q === "string") return q;
  if (Array.isArray(q) && q.length) return String(q[0] || "");
  return "";
}

function safeEmail(v: string) {
  const s = String(v || "").trim();
  if (!s) return "";
  return s.length > 180 ? s.slice(0, 180) : s;
}

function isTruthy(v: string) {
  const x = String(v || "").trim().toLowerCase();
  return x === "1" || x === "true" || x === "yes" || x === "y" || x === "founders";
}

const INSTAGRAM_URL = "https://instagram.com/ironacregym";

export default function WaitlistThanksPage() {
  const router = useRouter();

  const email = useMemo(() => safeEmail(getStr((router.query as any)?.email)), [router.query]);
  const founders = useMemo(() => isTruthy(getStr((router.query as any)?.founders)), [router.query]);

  async function shareWaitlist() {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/waitlist`
        : "https://ironacregym.vercel.app/waitlist";

    try {
      if (typeof navigator !== "undefined" && (navigator as any).share) {
        await (navigator as any).share({
          title: "Iron Acre Gym",
          text: "Join the Iron Acre Gym waitlist",
          url,
        });
        return;
      }
    } catch {
      // ignore
    }

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      // ignore
    }
  }

  return (
    <>
      <Head>
        <title>You’re in | Iron Acre Gym</title>
        <meta name="robots" content="noindex" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="wrap">
        <div className="shell">
          <div className="top">
            <div className="brand" aria-label="Iron Acre Gym">
              <span className="brandMark" aria-hidden="true" />
              <span className="brandText">Iron Acre Gym</span>
            </div>

            <div className="topLinks">
              <a className="topLink" href={INSTAGRAM_URL} target="_blank" rel="noreferrer">
                Instagram
              </a>
              <Link className="topLink" href="/waitlist">
                Back
              </Link>
            </div>
          </div>

          <div className="card ia-tile ia-tile-pad">
            <div className="tick" aria-hidden="true">
              ✓
            </div>

            <div className="title">You’re on the list</div>

            <div className="sub">
              {founders ? (
                <>
                  You’ve flagged interest in a founders spot.
                  <span className="subStrong"> We’ll email founders invites first.</span>
                </>
              ) : (
                <>
                  We’ll keep you in the loop with opening updates.
                  <span className="subStrong"> When founders opens, the list hears first.</span>
                </>
              )}
            </div>

            {email ? (
              <div className="emailRow">
                <div className="emailLabel">Confirmation sent to</div>
                <div className="emailValue">{email}</div>
              </div>
            ) : null}

            <div className="next">
              <div className="nextTitle">What happens next</div>
              <div className="nextGrid">
                <div className="nextItem">
                  <div className="nextKicker">Step one</div>
                  <div className="nextText">You’ll get first access to opening dates and the first session drops.</div>
                </div>
                <div className="nextItem">
                  <div className="nextKicker">Step two</div>
                  <div className="nextText">Founders invites go out to the list first. £60/month is locked for those spots.</div>
                </div>
                <div className="nextItem">
                  <div className="nextKicker">Step three</div>
                  <div className="nextText">Reply to the email if you want priority on a taster session when dates go live.</div>
                </div>
              </div>
            </div>

            <div className="actions">
              <a className="ia-btn ia-btn-primary actionBtn" href={INSTAGRAM_URL} target="_blank" rel="noreferrer">
                Follow updates on Instagram
              </a>

              <button type="button" className="ia-btn ia-btn-outline actionBtn" onClick={shareWaitlist}>
                Share the waitlist link
              </button>
            </div>

            <div className="fine">
              No payment is taken until one month after opening.
              <span className="fineDot" aria-hidden="true" />
              You can unsubscribe anytime.
            </div>
          </div>

          <div className="footer">
            <div>© {new Date().getFullYear()} Iron Acre Gym</div>
            <div className="footerLinks">
              <Link className="footerLink" href="/waitlist">
                Waitlist
              </Link>
              <a className="footerLink" href={INSTAGRAM_URL} target="_blank" rel="noreferrer">
                Instagram
              </a>
            </div>
          </div>
        </div>

        <style jsx>{`
          .wrap {
            min-height: 100vh;
            background: radial-gradient(1200px 600px at 15% 10%, rgba(0, 255, 170, 0.10), transparent 55%),
              radial-gradient(1100px 600px at 80% 0%, rgba(110, 168, 255, 0.10), transparent 60%),
              #06090d;
            color: #fff;
            display: flex;
            align-items: center;
          }
          .shell {
            width: 100%;
            max-width: 920px;
            margin: 0 auto;
            padding: 18px;
          }
          .top {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 12px;
          }
          .brand {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            min-height: 44px;
            user-select: none;
          }
          .brandMark {
            width: 34px;
            height: 34px;
            border-radius: 10px;
            background: linear-gradient(135deg, rgba(0, 255, 170, 0.95), rgba(0, 180, 255, 0.85));
            box-shadow: 0 12px 28px rgba(0, 255, 170, 0.18);
          }
          .brandText {
            font-weight: 750;
            letter-spacing: 0.2px;
          }
          .topLinks {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            justify-content: flex-end;
          }
          .topLink {
            color: rgba(255, 255, 255, 0.72);
            text-decoration: none;
            font-weight: 650;
            padding: 10px 8px;
            min-height: 44px;
          }
          .topLink:hover {
            color: rgba(255, 255, 255, 0.92);
          }
          .card {
            border-radius: 18px;
            background: rgba(11, 15, 20, 0.78);
            border: 1px solid rgba(255, 255, 255, 0.08);
            backdrop-filter: blur(10px);
            position: relative;
          }
          .tick {
            width: 42px;
            height: 42px;
            border-radius: 14px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: rgba(0, 255, 170, 0.18);
            border: 1px solid rgba(0, 255, 170, 0.30);
            color: rgba(255, 255, 255, 0.95);
            font-weight: 800;
            margin-bottom: 10px;
          }
          .title {
            font-size: 28px;
            font-weight: 700;
            letter-spacing: -0.2px;
            line-height: 1.1;
          }
          .sub {
            margin-top: 10px;
            color: rgba(255, 255, 255, 0.76);
            line-height: 1.5;
            font-weight: 450;
            max-width: 680px;
          }
          .subStrong {
            color: rgba(255, 255, 255, 0.92);
            font-weight: 650;
          }
          .emailRow {
            margin-top: 14px;
            padding: 12px 12px;
            border-radius: 14px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            background: rgba(7, 10, 15, 0.55);
          }
          .emailLabel {
            font-size: 12px;
            color: rgba(255, 255, 255, 0.62);
            font-weight: 600;
          }
          .emailValue {
            margin-top: 6px;
            font-weight: 650;
            color: rgba(255, 255, 255, 0.92);
            word-break: break-word;
          }
          .next {
            margin-top: 16px;
            border-top: 1px solid rgba(255, 255, 255, 0.06);
            padding-top: 14px;
          }
          .nextTitle {
            font-weight: 650;
            color: rgba(255, 255, 255, 0.92);
          }
          .nextGrid {
            margin-top: 10px;
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 10px;
          }
          .nextItem {
            border-radius: 14px;
            border: 1px solid rgba(255, 255, 255, 0.06);
            background: rgba(7, 10, 15, 0.50);
            padding: 12px;
          }
          .nextKicker {
            font-size: 12px;
            color: rgba(255, 255, 255, 0.62);
            font-weight: 600;
          }
          .nextText {
            margin-top: 6px;
            color: rgba(255, 255, 255, 0.76);
            line-height: 1.45;
            font-weight: 450;
          }
          .actions {
            margin-top: 14px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
          }
          .actionBtn {
            border-radius: 14px;
            min-height: 50px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            text-decoration: none;
            font-weight: 650;
          }
          .fine {
            margin-top: 12px;
            color: rgba(255, 255, 255, 0.56);
            font-size: 12px;
            line-height: 1.35;
            display: flex;
            gap: 8px;
            align-items: center;
            flex-wrap: wrap;
          }
          .fineDot {
            width: 4px;
            height: 4px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.35);
          }
          .footer {
            margin-top: 14px;
            padding-top: 14px;
            border-top: 1px solid rgba(255, 255, 255, 0.06);
            display: flex;
            justify-content: space-between;
            gap: 12px;
            flex-wrap: wrap;
            color: rgba(255, 255, 255, 0.55);
            font-size: 12px;
          }
          .footerLinks {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
          }
          .footerLink {
            color: rgba(255, 255, 255, 0.60);
            text-decoration: underline;
            text-underline-offset: 3px;
            font-weight: 600;
          }
          .footerLink:hover {
            color: rgba(255, 255, 255, 0.85);
          }
          @media (max-width: 860px) {
            .nextGrid {
              grid-template-columns: 1fr;
            }
            .actions {
              grid-template-columns: 1fr;
            }
          }
        `}</style>
      </div>
    </>
  );
}

