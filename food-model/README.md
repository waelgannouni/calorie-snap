Empty on purpose. The app's local food classifier (`src/lib/foodClassifier.ts`) looks here for
`model.json` + weight files + `labels.json` and gracefully stays off if they're missing. See
`food-model/README.md` at the project root for how to train and place a real model here.
