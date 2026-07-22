import Head from "next/head";

export default function JoinPage() {
  return (
    <>
      <Head>
        <title>Iron Acre Gym | Join</title>
        <meta
          name="description"
          content="Outdoor strength and conditioning in Suffolk. Small group coaching, real progression and a community built around hard work."
        />
      </Head>

      <main className="page">
        <section className="hero">
          <img src="/concept-3.jpg"></img>

          <div className="heroOverlay" />

          <div className="heroContent">
            <div className="eyebrow">IRON ACRE GYM</div>

            <h1>
              Not Another Gym.
              <br />
              A Place To Get Stronger.
            </h1>

            <p>
              Outdoor strength and conditioning in Suffolk. Small group
              coaching, real progression and a community built around
              hard work.
            </p>

            <div className="heroActions">
              <a href="447860861120?text=Hi%20Rob,%20I'd%20like%20to%20book%20a%20free%20trial%20session"
                className="primaryBtn"
                target="_blank"
                rel="noopener noreferrer"
              >
                Book Free Session
              </a>

              <a className="secondaryBtn">
                View Timetable
              </a>
            </div>
          </div>
        </section>

        <section className="trustBar">
          <div>12 Person Classes</div>
          <div>Outdoor Training</div>
          <div>Coach Led Sessions</div>
          <div>App Included</div>
        </section>

        <section className="section">
          <div className="eyebrow">ABOUT</div>

          <h2>Built Different.</h2>

          <p className="lead">
            No mirrors. No waiting for equipment. No overcrowded gym.
          </p>

          <p>
            Just great coaching, real people and training that actually
            improves your life.
          </p>
        </section>

        <section className="section">
          <div className="eyebrow">HOW WE TRAIN</div>

          <h2>Built Around Results</h2>

          <div className="trainingBlocks">
            <div className="trainingBlock">
              <h3>Farm Strength</h3>

              <p>
                Sandbags. Sleds. Carries. Kettlebells. Tyres.
              </p>

              <p>
                Build practical real-world strength that transfers into
                everyday life.
              </p>
            </div>

            <div className="trainingBlock">
              <h3>Farm Fit</h3>

              <p>
                Conditioning designed to improve fitness, resilience
                and work capacity.
              </p>
            </div>

            <div className="trainingBlock">
              <h3>Boxing</h3>

              <p>
                Learn proper technique while improving confidence,
                fitness and coordination.
              </p>
            </div>

            <div className="trainingBlock">
              <h3>Recovery</h3>

              <p>
                Mobility, stretching and recovery sessions that keep
                you progressing year round.
              </p>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="eyebrow">IRON ACRE APP</div>

          <h2>Your Coach In Your Pocket</h2>

          <p className="lead">
            Every membership includes access to the Iron Acre App.
          </p>

          <div className="appGrid">
            <div>Track Workouts</div>
            <div>Track Nutrition</div>
            <div>Progress Photos</div>
            <div>Weekly Check Ins</div>
            <div>Habit Tracking</div>
            <div>Structured Programmes</div>
          </div>

          <p>
            It's like having a coach with you every day, not just when
            you attend a session.
          </p>
        </section>

        <section id="timetable" className="section">
          <div className="eyebrow">TIMETABLE</div>

          <h2>Book Your Session</h2>

          <div className="timetableTable">
            <div className="timeRow">
              <span>MONDAY</span>
              <span>18:30</span>
              <span>Farm Strength</span>

              <a href="https://wa.me/447860861120?text=Hi%20Rob,%20I'd%20like%20to%20book%20Monday%20Farm%20Strength"
                className="bookBtn"
                target="_blank"
                rel="noopener noreferrer"
              >
                Book
              </a>
            </div>

            <div className="timeRow">
              <span>TUESDAY</span>
              <span>07:00</span>
              <span>Farm Strength</span>

              <a href="https://wa.me/447860861120?text=Hi%20Rob,%20I'd%20like%20to%20book%20Tuesday%20Farm%20Strength"
                className="bookBtn"
                target="_blank"
                rel="noopener noreferrer"
            </div>

            <div className="timeRow">
              <span>WEDNESDAY</span>
              <span>18:30</span>
              <span>Farm Strength</span>

              <a
                href="https://wa.me/447860861120?text=Hi%20Rob,%20I'd%20like%20to%20book%20Wednesday%20Farm%20Strength"
                className="bookBtn"
   section className="section">
          <div className="eyebrow">COMMUNITY</div>

          <h2>More Than A Gym</h2>

          <p>
            At the centre of Iron Acre is the firepit.
          </p>

          <p>
            A place to sit after sessions, share stories, celebrate
            wins and build friendships.
          </p>

          <p>
            The best gyms aren't built on equipment. They're built on
            people.
          </p>
        </section>

        <section className="section">
          <div className="eyebrow">BUILD JOURNEY</div>

          <h2>Built From The Ground Up</h2>

          <div className="timeline">
            <div className="timelineItem">
              <h4>Empty Field</h4>
            </div>

            <div className="timelineItem">
              <h4>Ground Preparation</h4>
            </div>

            <div className="timelineItem">
              <h4>Hardcore Base Installed</h4>
            </div>

            <div className="timelineItem">
              <h4>Sled Track Built</h4>
            </div>

            <div className="timelineItem">
              <h4>Pergola Construction</h4>
            </div>

            <div className="timelineItem">
              <h4>Equipment Build</h4>
            </div>

            <div className="timelineItem">
              <h4>Founders Sessions</h4>
            </div>

            <div className="timelineItem">
              <h4>Opening Day</h4>
            </div>
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
            Every member becomes part of the story we're building here.
          </p>
        </section>

        <section className="cta">
          <h2>Come And Try Iron Acre</h2>

          <p>Your first week is completely free.</p>

          <a
            href="https://wa.me/447860861120?text=Hi%20Rob,%20I'd%20like%20to%20book%20a%20free%20trial%20session"
                  <style jsx>{`
        .page {
          background: #06090d;
          color: #fff;
        }

        .hero {
          position: relative;
          min-height: 75vh;
          overflow: hidden;
          display: flex;
          align-items: center;
        }

        .heroImage {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
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
          max-width: 800px;
          margin: auto;
          padding: 24px;
        }

        .eyebrow {
          color: #18ff9a;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 2px;
          margin-bottom: 12px;
        }

        h1 {
          font-size: clamp(3rem, 7vw, 5.5rem);
          line-height: 0.95;
          margin-bottom: 24px;
        }

        h2 {
          font-size: clamp(2rem, 5vw, 3.5rem);
          margin-bottom: 24px;
        }

        .lead {
          font-size: 1.25rem;
        }

        .heroActions {
          display: flex;
          gap: 16px;
          margin-top: 30px;
          flex-wrap: wrap;
        }

        .primaryBtn,
        .bookBtn {
          background: #18ff9a;
          color: #000;
          text-decoration: none;
          padding: 14px 24px;
          border-radius: 12px;
          font-weight: 700;
        }

        .secondaryBtn {
          border: 1px solid rgba(255,255,255,.2);
          color: #fff;
          text-decoration: none;
          padding: 14px 24px;
          border-radius: 12px;
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

        .trainingBlocks {
          display: grid;
          gap: 24px;
        }

        .trainingBlock {
          background: #0b0f14;
          padding: 40px;
          border-radius: 24px;
          border: 1px solid rgba(255,255,255,.08);
        }

        .trainingBlock h3 {
          color: #18ff9a;
          margin-bottom: 16px;
        }

        .appGrid {
          display: grid;
          grid-template-columns: repeat(auto-fit,minmax(220px,1fr));
          gap: 16px;
          margin: 30px 0;
        }

        .appGrid div {
          background: #0b0f14;
          padding: 24px;
          border-radius: 18px;
        }

        .timetableTable {
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 24px;
          overflow: hidden;
        }

        .timeRow {
          display: grid;
          grid-template-columns: 1.5fr 120px 1fr auto;
          gap: 16px;
          align-items: center;
          padding: 24px;
          border-bottom: 1px solid rgba(255,255,255,.08);
        }

        .timeline {
          position: relative;
          max-width: 700px;
        }

        .timeline::before {
          content: "";
          position: absolute;
          left: 20px;
          top: 0;
          bottom: 0;
          width: 2px;
          background: #18ff9a;
        }

        .timelineItem {
          position: relative;
          padding-left: 60px;
          margin-bottom: 40px;
        }

        .timelineItem::before {
          content: "";
          position: absolute;
          left: 13px;
          top: 6px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #18ff9a;
        }

        .cta {
          text-align: center;
          padding: 120px 24px;
          background: linear-gradient(
            180deg,
            transparent,
            rgba(24,255,154,.08)
          );
        }

        @media (max-width: 768px) {
          .trustBar {
            grid-template-columns: 1fr 1fr;
          }

          .timeRow {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}
