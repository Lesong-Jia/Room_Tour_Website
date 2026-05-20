import { useEffect, useState } from "react";

const INTRO_DURATION_SECONDS = 3 * 60;

const ENVIRONMENT_SECTIONS = [
  {
    id: "floor-plan",
    title: "Floor Plan",
    summary:
      "This is the layout of your home. In this experiment, the kitchen and living room are the two main areas you should focus on.",
    items: [
      {
        title: "Home Layout",
        image: "/environment/Floor_Plan.png",
        alt: "Floor plan of the home",
        featured: true,
        text: "Use this floor plan to remember how the main rooms connect, especially the kitchen and living room."
      }
    ]
  },
  {
    id: "kitchen",
    title: "Kitchen and Dining Area",
    summary:
      "This is your kitchen and dining area. Try to remember the household habits, item locations, and equipment notes below.",
    items: [
      {
        title: "Kitchen Overview",
        image: "/environment/Kitchen_Overall.png",
        alt: "Overview of the kitchen and dining area",
        featured: true,
        text: "This area includes your kitchen appliances, food storage, and dining table."
      },
      {
        title: "Trash Cans",
        image: "/environment/Kitchen_Trash_Can.png",
        alt: "White and black trash cans in the kitchen",
        text: "You usually use the white trash can for recyclable waste and the black trash can for non-recyclable waste."
      },
      {
        title: "Dining Table",
        image: "/environment/Kitchen_Dining_Table.png",
        alt: "Dining table with tableware",
        text: "Your tableware is on the dining table. You prefer to use plates for dishes, and bowls for rice and soup."
      },
      {
        title: "Fridge",
        image: "/environment/Kitchen_Fridge.png",
        alt: "Kitchen fridge",
        text: "The upper section is the refrigerator and the lower section is the freezer. You keep foods you like here, including canned tuna and carrots."
      },
      {
        title: "Coffee Machine",
        image: "/environment/Kitchen_Coffee_Machine.png",
        alt: "Coffee machine and coffee cup",
        text: "This is your automatic coffee machine. You have a dedicated gray coffee cup that you use for coffee."
      },
      {
        title: "Cutting Boards",
        image: "/environment/Kitchen_Cutting_Board.png",
        alt: "Two cutting boards in the kitchen",
        text: "You use the smaller dark cutting board for vegetables and fruit, and the larger light cutting board for meat."
      },
      {
        title: "Microwaves",
        image: "/environment/Kitchen_Microwave.png",
        alt: "Two microwaves in the kitchen",
        text: "You have two microwaves. The built-in microwave recently broke, so you bought the white microwave and use that one now."
      }
    ]
  },
  {
    id: "living-room",
    title: "Living Room",
    summary:
      "This is your living room. Pay attention to the care routines, cleaning tools, decorative items, and book storage habits.",
    items: [
      {
        title: "Living Room Overview",
        image: "/environment/Living_Room_Overall.png",
        alt: "Overview of the living room",
        text: "This is your living room. Try to remember the items you keep here and the habits you follow when caring for plants, cleaning surfaces, using candles, and organizing books.",
        featured: true
      },
      {
        title: "Plant",
        image: "/environment/Living_Room_Plant.png",
        alt: "Living room plants and spray bottles",
        text: "This is your plant. The gray spray bottle is for watering it, and the white bottle with the green label contains plant food."
      },
      {
        title: "Cleaning Rags",
        image: "/environment/Living_Room_Rag.png",
        alt: "Green and blue cleaning rags",
        text: "These are your cleaning rags. The green rag is only for cleaning screens, and the blue rag is for wiping tables."
      },
      {
        title: "Candles",
        image: "/environment/Living_Room_Candle.png",
        alt: "Decorative and scented candles",
        text: "These are your candles. The thin white candles are decorative, and the green candle is a bamboo-scented candle."
      },
      {
        title: "Shelves and Books",
        image: "/environment/Living_Room_Book.png",
        alt: "Living room shelves and books",
        text: "This is your storage shelf and bookshelf. You put books you have already read in the box on the bottom shelf, and unread books on the shelf above it."
      }
    ]
  }
];

export default function EnvironmentIntroPage({ onContinue }) {
  const [hasStarted, setHasStarted] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [startedAt, setStartedAt] = useState(null);
  const [remainingSeconds, setRemainingSeconds] = useState(
    INTRO_DURATION_SECONDS
  );
  const timerLabel = formatTime(remainingSeconds);

  useEffect(() => {
    if (!hasStarted || isComplete || !startedAt) {
      return undefined;
    }

    function updateRemainingTime() {
      const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
      const nextRemainingSeconds = Math.max(
        INTRO_DURATION_SECONDS - elapsedSeconds,
        0
      );

      setRemainingSeconds(nextRemainingSeconds);

      if (nextRemainingSeconds === 0) {
        setIsComplete(true);
      }
    }

    updateRemainingTime();

    const timerId = window.setInterval(() => {
      updateRemainingTime();
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [hasStarted, isComplete, startedAt]);

  function handleStart() {
    setRemainingSeconds(INTRO_DURATION_SECONDS);
    setStartedAt(Date.now());
    setHasStarted(true);
    setIsComplete(false);
  }

  if (isComplete) {
    return (
      <section
        className="environment-intro-page"
        aria-label="Environment introduction complete"
      >
        <div className="environment-complete-panel panel">
          <h1>Environment Introduction Complete</h1>
          <p>
            Congratulations on completing the environment introduction. Please
            click the button below to continue to the next part of the
            experiment, where you will have a further first-meeting interaction
            with the robot.
          </p>
          <div className="environment-intro-actions">
            <button className="primary-action" type="button" onClick={onContinue}>
              Continue
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="environment-intro-page"
      aria-label="Environment introduction"
    >
      {!hasStarted ? (
        <div className="environment-intro-header panel">
        <div className="environment-intro-copy">
          <h1>Environment Introduction</h1>
          <p className="environment-intro-subtitle">
            Memorize Your Home Environment
          </p>
          <p>
            Next, you will see information about a home environment. Please
            imagine that this is your own home, including your daily habits,
            preferences, and equipment issues. You will have{" "}
            <strong>three minutes</strong> to remember the information as clearly
            as you can.
          </p>
          <div className="environment-intro-actions">
            <button className="primary-action" type="button" onClick={handleStart}>
              Start
            </button>
          </div>
        </div>
        </div>
      ) : null}

      {hasStarted ? (
        <div className="environment-timer" role="timer" aria-label="Time remaining">
        <div className="environment-timer-copy">
          <span className="environment-timer-label">Time remaining</span>
          <span className="environment-timer-instruction">
            Please memorize the information on this page as much as possible.
            When time is up, you will continue to the next stage.
          </span>
        </div>
        <span className="environment-timer-value">{timerLabel}</span>
        {remainingSeconds === 0 ? (
          <span className="environment-timer-ended">Time is up</span>
        ) : null}
        </div>
      ) : null}

      {hasStarted ? (
        <div className="environment-section-list">
        {ENVIRONMENT_SECTIONS.map((section) => (
          <section
            className="environment-info-section"
            key={section.id}
            aria-labelledby={`${section.id}-title`}
          >
            <div className="environment-section-heading">
              <h2 id={`${section.id}-title`}>{section.title}</h2>
              <p>{section.summary}</p>
            </div>

            <div className="environment-item-grid">
              {section.items.map((item) => (
                <article
                  className={`environment-item-card${
                    item.featured ? " featured" : ""
                  }${item.image ? "" : " text-only"}`}
                  key={item.title}
                >
                  {item.image ? (
                    <img src={item.image} alt={item.alt} loading="lazy" />
                  ) : null}
                  <div className="environment-item-copy">
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
        </div>
      ) : null}
    </section>
  );
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
