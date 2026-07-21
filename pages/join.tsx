// pages/join.tsx

import Head from "next/head";
import Image from "next/image";

export default function JoinPage() {
  return (
    <>
      <Head>
        <title>Iron Acre Gym | Join</title>

        <meta
          name="description"
          content="Outdoor Strength & Conditioning in Suffolk. Small group coaching, Farm Strength, Farm Fit, personal training and recovery sessions."
        />
      </Head>

      <main className="page">
        <section className="hero">
          -3.jpg"
            alt="Iron Acre Gym"
            fill
            priority
            className="heroImage"
          />

          <div className="heroOverlay" />

          <div className="heroContent">
            <div className="eyebrow">IRON ACRE GYM</div>

            <h1>
              Outdoor Strength
              <br />
              & Conditioning
            </h1>

            <p>
              Small group coaching. Real strength training. Built
              differently.
            </p>

            <div className="heroActions">
              #trial

              #timetable
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

          <div className="content">
            <span className="eyebrow">ABOUT</span>

            <h2>
              Not another
              <br />
              commercial gym.
            </h2>

            <p>
              No mirrors.
            </p>

            <p>
              No waiting for equipment.
            </p>

            <p>
              No wondering what workout to do.
            </p>

            <p>
              Just great coaching, real people and training that
              actually improves your life.
            </p>
          </div>
        </section>

        <section className="section">
          <span className="eyebrow">CLASSES</span>

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
                Conditioning focused sessions designed to improve
                fitness and work capacity.
              </p>
            </div>

            <div className="classCard">
              <h3>Boxing</h3>
              <p>
                Skill work, conditioning and bag training.
              </p>
            </div>

            <div className="classCard">
              <h3>Recovery</h3>
              <p>
                Mobility, stretching and recovery focused sessions.
              </p>
            </div>
          </div>
        </section>

        <section id="timetable" className="section">
          <span className="eyebrow">TIMETABLE</span>

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

          <div className="smallText">
            Maximum 12 people per class.
          </div>
        </section>

        <section className="section workout">
          <span className="eyebrow">SAMPLE WORKOUT</span>

          <h2>Farm Strength</h2>

          <div className="workoutCard">
            <div>200m Sandbag Carry</div>
            <div>15 Sandbag Cleans</div>
            <div>20 Kettlebell Swings</div>
            <div>200m Run</div>
          </div>
        </section>

        <section className="section">
          <span className="eyebrow">BUILD JOURNEY</span>

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
          <span className="eyebrow">FOUNDER</span>

          <h2>Meet Rob</h2>

          <div className="founder">
            <p>
              I built Iron Acre because I wanted the gym I
              couldn't find locally.
            </p>

            <p>
              Somewhere people could train hard, get stronger
              and actually enjoy turning up every week.
            </p>

            <p>
              Iron Acre is being built from scratch and every
              member becomes part of that story.
            </p>
          </div>
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
          color: white;
          min-height: 100vh;
        }

        .hero {
          height: 100vh;
          position: relative;
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
          max-width: 1100px;
          margin: 0 auto;
          width: 100%;
          padding: 24px;
        }

        .eyebrow {
          color: #18ff9a;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 2px;
        }

        h1 {
          font-size: clamp(3rem, 8vw, 6rem);
          line-height: 1;
          margin: 16px 0;
        }

        h2 {
          font-size: clamp(2rem, 4vw, 3.5rem);
          margin-bottom: 24px;
        }

        .heroActions {
          display: flex;
          gap: 16px;
          margin-top: 32px;
          flex-wrap: wrap;
        }

        .primaryBtn {
          background: #18ff9a;
          color: black;
          padding: 14px 24px;
          border-radius: 12px;
          font-weight: 700;
          text-decoration: none;
        }

        .secondaryBtn {
          border: 1px solid rgba(255,255,255,.2);
          color: white;
          padding: 14px 24px;
          border-radius: 12px;
          text-decoration: none;
        }

        .trustBar {
          display: grid;
          grid-template-columns: repeat(4,1fr);
          text-align: center;
          border-top: 1px solid rgba(255,255,255,.08);
          border-bottom: 1px solid rgba(255,255,255,.08);
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
          position: relative;
          height: 600px;
          border-radius: 24px;
          overflow: hidden;
        }

        .cover {
          object-fit: cover;
        }

        .classGrid,
        .timetable,
        .timeline {
          display: grid;
          grid-template-columns: repeat(auto-fit,minmax(250px,1fr));
          gap: 24px;
        }

        .classCard,
        .workoutCard,
        .timeline div,
        .timetable div {
          background: #0b0f14;
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 20px;
          padding: 24px;
        }

        .workoutCard {
          display: grid;
          gap: 12px;
          max-width: 600px;
        }

        .cta {
          text-align: center;
          padding: 140px 24px;
          background: linear-gradient(
            180deg,
            transparent,
            rgba(24,255,154,.08)
          );
        }

        @media (max-width: 900px) {
          .intro {
            grid-template-columns: 1fr;
          }

          .trustBar {
            grid-template-columns: 1fr 1fr;
          }
        }
      `}</style>
    </>
  );
}
