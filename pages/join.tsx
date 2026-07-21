import Head from "next/head";
import Image from "next/image";

export default function JoinPage() {
  return (
    <>
      <Head>
        <title>Join Iron Acre Gym</title>
        <meta
          name="description"
          content="Outdoor strength and conditioning in Suffolk. Small group coaching, real training and a great community."
        />
      </Head>

      <main className="page">
        <section className="hero">
          <img href="/concept-3.jpg"></img>

          <div className="heroOverlay" />

          <div className="heroContent">
            <div className="eyebrow">IRON ACRE GYM</div>

            <h1>
              Outdoor Strength
              <br />
              &amp; Conditioning
            </h1>

            <p>
              Small group coaching. Real strength training. Built
              differently.
            </p>

            <div className="heroActions">
              #trial

              " className="secondaryBtn">
                View Timetable
              </a>
            </div>
          </div>
        </section>

        <section className="trustBar">
          <div>12 Person Classes</div>
          <div>Outdoor Gym</div>
          <div>Coached Sessions</div>
          <div>Training App Included</div>
        </section>

        <section className="section intro">
          <div className="imageWrap">
            /concept-2.jpg
          </div>

          <div>
            <div className="eyebrow">ABOUT</div>

            <h2>Not another commercial gym.</h2>

            <p>
              No mirrors. No waiting for equipment. No wondering what
              workout to do.
            </p>

            <p>
              Just great coaching, real people and training that
              actually improves your life.
            </p>
          </div>
        </section>

        <section className="section">
          <div className="eyebrow">CLASSES</div>

          <h2>How We Train</h2>

          <div className="classGrid">
            <div className="classCard">
              <h3>Farm Strength</h3>
              <p>
                Sandbags, carries, sleds and functional strength.
              </p>
            </div>

            <div className="classCard">
              <h3>Farm Fit</h3>
              <p>
                Conditioning-focused training that builds work
                capacity.
              </p>
            </div>

            <div className="classCard">
              <h3>Boxing</h3>
              <p>
                Technique, bags, conditioning and skill development.
              </p>
            </div>

            <div className="classCard">
              <h3>Recovery</h3>
              <p>
                Mobility, stretching and recovery-focused sessions.
              </p>
            </div>
          </div>
        </section>

        <section id="timetable" className="section">
          <div className="eyebrow">TIMETABLE</div>

          <h2>Train Around Your Life</h2>

          <div className="timetable">
            <div>
              <h3>Monday</h3>
              <p>18:30 Farm Strength</p>
              <p>19:45 Farm Fit</p>
            </div>

            <div>
              <h3>Tuesday</h3>
              <p>07:00 Farm Strength</p>
            </div>

            <div>
              <h3>Thursday</h3>
              <p>18:30 Farm Strength</p>
              <p>19:45 Farm Fit</p>
            </div>

            <div>
              <h3>Friday</h3>
              <p>07:00 Farm Strength</p>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="eyebrow">BUILD JOURNEY</div>

          <h2>Built From The Ground Up</h2>

          <div className="timeline">
            <div>Empty Field</div>
            <div>Ground Preparation</div>
            <div>Hardcore Base</div>
            <div>Sled Track</div>
            <div>Pergola Build</div>
            <div>Equipment Build</div>
            <div>Founders Sessions</div>
            <div>Opening Day</div>
          </div>
        </section>

        <section className="section">
          <div className="eyebrow">FOUNDER</div>

          <h2>Meet Rob</h2>

          <p>
            I built Iron Acre because I wanted the gym I couldn't find
            locally.
          </p>

          <p>
            Somewhere people could train hard, get stronger and enjoy
            turning up every week.
          </p>

          <p>
            Iron Acre is being built from scratch and every member
            becomes part of that story.
          </p>
        </section>

        <section id="trial" className="cta">
          <h2>Try Your First Session Free</h2>

          <p>
            No contracts. No pressure. Just great training.
          </p>

          /contact
        </section>
      </main>

      <style jsx>{`
        .page {
          background: #06090d;
          color: #fff;
          min-height: 100vh;
        }

        .hero {
          position: relative;
          min-height: 100vh;
          display: flex;
          align-items: center;
        }

        .heroImage {
          object-fit: cover;
        }

        .heroOverlay {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.55);
        }

        .heroContent {
          position: relative;
          z-index: 2;
          max-width: 1200px;
          margin: 0 auto;
          padding: 24px;
          width: 100%;
        }

        .eyebrow {
          color: #18ff9a;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 2px;
          margin-bottom: 12px;
        }

        h1 {
          font-size: clamp(3rem, 8vw, 6rem);
          line-height: 1;
          margin-bottom: 20px;
        }

        h2 {
          margin-bottom: 20px;
          font-size: clamp(2rem, 4vw, 3rem);
        }

        .heroActions {
          display: flex;
          gap: 16px;
          margin-top: 32px;
          flex-wrap: wrap;
        }

        .primaryBtn {
          background: #18ff9a;
          color: #000;
          text-decoration: none;
          padding: 14px 24px;
          border-radius: 12px;
          font-weight: 700;
        }

        .secondaryBtn {
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: white;
          text-decoration: none;
          padding: 14px 24px;
          border-radius: 12px;
        }

        .trustBar {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          text-align: center;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .trustBar div {
          padding: 20px;
        }

        .section {
          max-width: 1200px;
          margin: 0 auto;
          padding: 100px 24px;
        }

        .intro {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 60px;
          align-items: center;
        }

        .imageWrap {
          height: 500px;
          position: relative;
          overflow: hidden;
          border-radius: 24px;
        }

        .cover {
          object-fit: cover;
        }

        .classGrid,
        .timetable,
        .timeline {
          display: grid;
          grid-template-columns: repeat(
            auto-fit,
            minmax(250px, 1fr)
          );
          gap: 20px;
        }

        .classCard,
        .timetable div,
        .timeline div {
          background: #0b0f14;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 24px;
        }

        .cta {
          text-align: center;
          padding: 120px 24px;
          background: linear-gradient(
            180deg,
            transparent,
            rgba(24, 255, 154, 0.08)
          );
        }

        @media (max-width: 900px) {
          .intro {
            grid-template-columns: 1fr;
          }

          .trustBar {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 640px) {
          .trustBar {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}
