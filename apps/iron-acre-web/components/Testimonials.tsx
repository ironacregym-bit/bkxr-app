export default function Testimonials() {
  const reviews = [
    {
      name: "Chris",
      quote:
        "Awesome farm setting gym.",
    },
    {
      name: "Elaine",
      quote:
        "Felt comfortable as soon as I came.",
    },
    {
      name: "Ross",
      quote:
        "Got me lifting big weights again.",
    },
  ];

  return (
    <section className="ia-section">

      <div className="ia-container">

        <h2>
          Members Stick Around
        </h2>

        <div className="ia-grid-3">

          {reviews.map((review) => (
            <div
              key={review.name}
              className="ia-card"
            >
              <p>
                "{review.quote}"
              </p>

              <strong>
                {review.name}
              </strong>

            </div>
          ))}

        </div>

      </div>

    </section>
  );
}
