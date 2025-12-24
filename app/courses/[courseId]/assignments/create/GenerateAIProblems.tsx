import {
  Autocomplete,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  TextField,
} from "@mui/material";
import React, { useState } from "react";
import LightbulbIcon from "@mui/icons-material/Lightbulb";
import NumberField from "./NumberField";
import { Topic, Problem } from "@/app/types";

interface GenerateAIProblemsProps {
  topics: Topic[];
  problems: Problem[];
  setProblems: React.Dispatch<React.SetStateAction<Problem[]>>;
}

const GenerateAIProblems = ({
  topics,
  problems,
  setProblems,
}: GenerateAIProblemsProps) => {
  const [generateAIProblemsModalOpen, setGenerateAIProblemsModalOpen] =
    useState(false);
  const [numberOfQuestions, setNumberOfQuestions] = useState(5);
  const [difficulty, setDifficulty] = useState("medium");
  const [selectedTopics, setSelectedTopics] = useState<Topic[]>([]);
  const [additionalInstructions, setAdditionalInstructions] = useState("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = {
      numberOfQuestions,
      difficulty,
      topics: selectedTopics,
      additionalInstructions,
    };

    console.log("Form Data:", formData);

    // TODO: Call your AI generation API here
    // For now, this is a placeholder - you'll need to implement the actual AI generation
    // and then add the generated problems to the problems array using setProblems

    // Example of how you might add generated problems:
    // const generatedProblems = await generateProblemsWithAI(formData);
    // setProblems([...problems, ...generatedProblems]);

    setGenerateAIProblemsModalOpen(false);
  };

  return (
    <>
      <Button
        className="bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 px-6 rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 font-medium shadow-md flex items-center justify-center gap-2 w-1/2"
        onClick={() => setGenerateAIProblemsModalOpen(true)}
      >
        <LightbulbIcon />
        Generate with AI
      </Button>
      <Dialog
        open={generateAIProblemsModalOpen}
        onClose={() => setGenerateAIProblemsModalOpen(false)}
      >
        <DialogTitle>Generate Problems (max of 15)</DialogTitle>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <NumberField
              required
              label="Number of Questions to Generate"
              min={1}
              max={15}
              value={numberOfQuestions}
              onChange={setNumberOfQuestions}
            />
            <RadioGroup
              sx={{ mt: 1, mb: 2 }}
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
            >
              <FormLabel>Difficulty</FormLabel>
              <FormControlLabel
                value="easy"
                control={<Radio color="error" />}
                label="Easy"
              />
              <FormControlLabel
                value="medium"
                control={<Radio color="error" />}
                label="Medium"
                color="error"
              />
              <FormControlLabel
                value="hard"
                control={<Radio color="error" />}
                label="Hard"
                color="error"
              />
            </RadioGroup>
            <Autocomplete
              id="topics"
              multiple
              options={topics}
              getOptionLabel={(option) => option.name}
              value={selectedTopics}
              onChange={(_, newValue) => setSelectedTopics(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Select topics to generate questions about"
                  size="small"
                  label="Topics"
                  color="error"
                />
              )}
              sx={{ mt: 1, mb: 2 }}
            />
            <TextField
              margin="dense"
              id="additional-instructions"
              name="additionalInstructions"
              label="Additional Instructions"
              color="error"
              type="text"
              fullWidth
              multiline
              variant="standard"
              value={additionalInstructions}
              onChange={(e) => setAdditionalInstructions(e.target.value)}
            />
            <Button type="submit">Submit</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default GenerateAIProblems;
