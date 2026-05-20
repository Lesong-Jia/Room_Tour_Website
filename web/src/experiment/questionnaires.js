export const questionnaireScopes = [
  {
    id: "pre_experiment",
    label: "Pre-experiment questionnaire"
  },
  {
    id: "trial",
    label: "Trial-level questionnaire"
  },
  {
    id: "phase_end",
    label: "Phase-end questionnaire"
  }
];

export const preExperimentQuestionnaire = {
  id: "human_domestic_robot_communication_pre_experiment",
  sourceSurveyId: "SV_b1vL5BaT0H1NHy6",
  title: "Personal Background Questionnaire",
  subtitle:
    "Please answer the questions below before entering the experiment scene.",
  scope: "pre_experiment",
  phase: "pre_experiment_questionnaire",
  scaleOptions: [
    {
      value: "1",
      label: "Disagree strongly"
    },
    {
      value: "2",
      label: "Disagree a little"
    },
    {
      value: "3",
      label: "Neither agree nor disagree"
    },
    {
      value: "4",
      label: "Agree a little"
    },
    {
      value: "5",
      label: "Agree strongly"
    }
  ],
  experienceScaleOptions: [
    {
      value: "1",
      label: "No experience"
    },
    {
      value: "2",
      label: "A little"
    },
    {
      value: "3",
      label: "A moderate amount"
    },
    {
      value: "4",
      label: "A lot"
    },
    {
      value: "5",
      label: "A great deal"
    }
  ],
  sections: [
    {
      id: "demographics",
      title: "Demographic Information",
      questions: [
        {
          id: "QID3",
          exportTag: "Age",
          type: "single_choice",
          prompt: "How old are you?",
          required: true,
          options: [
            { value: "1", label: "18-24 years old" },
            { value: "2", label: "25-34 years old" },
            { value: "3", label: "35-44 years old" },
            { value: "4", label: "45-54 years old" },
            { value: "5", label: "55-64 years old" },
            { value: "6", label: "65+ years old" },
            { value: "7", label: "Prefer not to say" }
          ]
        },
        {
          id: "QID4",
          exportTag: "Gender",
          type: "single_choice",
          prompt: "How do you describe yourself?",
          required: true,
          allowOtherTextFor: "4",
          otherTextLabel: "Self-description",
          options: [
            { value: "1", label: "Male" },
            { value: "2", label: "Female" },
            { value: "3", label: "Non-binary / third gender" },
            { value: "4", label: "Prefer to self-describe" },
            { value: "5", label: "Prefer not to say" }
          ]
        }
      ]
    },
    {
      id: "robot_experience",
      title: "Robot Experience",
      questions: [
        {
          id: "QID5",
          exportTag: "Q5",
          type: "multi_choice",
          prompt: "Which of the following robots have you used or interacted with before?",
          helper:
            "Robots here refer to physically embodied systems, such as robot vacuums, delivery robots, social robots, robotic arms, or other home/service robots.",
          required: true,
          options: [
            { value: "1", label: "Robot vacuum / mopping robot" },
            { value: "2", label: "Smart home robot / companion robot" },
            { value: "3", label: "Delivery robot" },
            { value: "4", label: "Robotic arm" },
            { value: "5", label: "Educational robot" },
            { value: "6", label: "Other" },
            {
              value: "none",
              label: "I have not used or interacted with these robots before",
              exclusive: true
            }
          ],
          allowOtherTextFor: "6",
          otherTextLabel: "Other robot type"
        },
        {
          id: "QID6",
          exportTag: "Q6",
          type: "single_choice",
          prompt:
            "How much experience have you had with robot vacuums / mopping robots?",
          required: true,
          optionsRef: "experienceScaleOptions",
          visibleWhen: {
            questionId: "QID5",
            includes: "1"
          }
        },
        {
          id: "QID7",
          exportTag: "Q7",
          type: "single_choice",
          prompt:
            "How much experience have you had with smart home robots / companion robots?",
          required: true,
          optionsRef: "experienceScaleOptions",
          visibleWhen: {
            questionId: "QID5",
            includes: "2"
          }
        },
        {
          id: "QID8",
          exportTag: "Q8",
          type: "single_choice",
          prompt: "How much experience have you had with delivery robots?",
          required: true,
          optionsRef: "experienceScaleOptions",
          visibleWhen: {
            questionId: "QID5",
            includes: "3"
          }
        },
        {
          id: "QID10",
          exportTag: "Q10",
          type: "single_choice",
          prompt: "How much experience have you had with robotic arms?",
          required: true,
          optionsRef: "experienceScaleOptions",
          visibleWhen: {
            questionId: "QID5",
            includes: "4"
          }
        },
        {
          id: "QID11",
          exportTag: "Q11",
          type: "single_choice",
          prompt: "How much experience have you had with educational robots?",
          required: true,
          optionsRef: "experienceScaleOptions",
          visibleWhen: {
            questionId: "QID5",
            includes: "5"
          }
        },
        {
          id: "QID9",
          exportTag: "Q9",
          type: "single_choice",
          prompt: "How much experience have you had with the robot type you described?",
          required: true,
          optionsRef: "experienceScaleOptions",
          visibleWhen: {
            questionId: "QID5",
            includes: "6"
          }
        }
      ]
    },
    {
      id: "attitude",
      title: "Attitudes Toward Domestic Robots",
      description:
        "A domestic robot in the future may be able to assist with household tasks such as cleaning, fetching items, organizing belongings, monitoring the home, or providing daily assistance.",
      questions: [
        {
          id: "QID13",
          exportTag: "Q13",
          type: "likert_group",
          required: true,
          prompt:
            "Please indicate the extent to which you agree or disagree with each statement.",
          optionsRef: "scaleOptions",
          items: [
            {
              id: "1",
              text: "I think it is a good idea to use domestic robots."
            },
            {
              id: "2",
              text: "Domestic robots would make life more interesting."
            },
            {
              id: "3",
              text: "It would be good to make use of domestic robots."
            },
            {
              id: "4",
              text: "I would trust a domestic robot to perform household tasks well."
            },
            {
              id: "5",
              text: "I would rely on a domestic robot to complete household tasks."
            }
          ]
        }
      ]
    },
    {
      id: "personality",
      title: "Personality",
      description:
        "The following items are from the 10-Item Big Five Inventory (BFI-10).",
      questions: [
        {
          id: "QID12",
          exportTag: "Q12",
          type: "likert_group",
          required: true,
          prompt:
            "Please indicate the extent to which you agree or disagree with each statement.",
          optionsRef: "scaleOptions",
          items: [
            {
              id: "1",
              text: "I see myself as someone who is reserved."
            },
            {
              id: "2",
              text: "I see myself as someone who is generally trusting."
            },
            {
              id: "3",
              text: "I see myself as someone who tends to be lazy."
            },
            {
              id: "4",
              text: "I see myself as someone who is relaxed and handles stress well."
            },
            {
              id: "5",
              text: "I see myself as someone who has few artistic interests."
            },
            {
              id: "6",
              text: "I see myself as someone who is outgoing and sociable."
            },
            {
              id: "7",
              text: "I see myself as someone who tends to find fault with others."
            },
            {
              id: "8",
              text: "I see myself as someone who does a thorough job."
            },
            {
              id: "9",
              text: "I see myself as someone who gets nervous easily."
            },
            {
              id: "10",
              text: "I see myself as someone who has an active imagination."
            }
          ]
        }
      ]
    }
  ]
};
