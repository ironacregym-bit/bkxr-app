import Head from "next/head";
import styles from "../styles/join.module.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";

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

          <div className="heroOverlay"></div>

          <div className="heroContent">
            <div className="eyebrow">IRON ACRE GYM</div>

            <h1>
              Outdoor Training
              <br />
              Strength Rooted In Nature
            </h1>

            <p>
              Outdoor strength and conditioning in Suffolk. Small group
              coaching, real progression and a community built around
              hard work.
            </p>

            <div className="heroActions">
              <a href="https://wa.me/447860861120?text=Hi%20Rob,%20I'd%20like%20to%20book%20a%20free%20trial%20session"
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
                rel="noopener noreferrer" >Book
              </a>
            </div>

            <div className="timeRow">
              <span>WEDNESDAY</span>
              <span>18:30</span>
              <span>Farm Strength</span>

              <a
                href="https://wa.me/447860861120?text=Hi%20Rob,%20I'd%20like%20to%20book%20Wednesday%20Farm%20Strength"
                className="bookBtn"
                target="_blank"
                rel="noopener noreferrer">Book</a>
            </div>
          </div>
        </section>
        <section>
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
      </main>
    </>
  );
}
