(async () => {
    const URL = "my_model/";

    const sounds = {
        "up": new Audio("my_sounds/up.mp3"),
        "toleft": new Audio("my_sounds/toleft.mp3"),
    };

    const images = {
       
	    "up": "my_images/up.jpg",
        "toleft": "my_images/toleft.jpg",
        };

    let model = null, webcam = null;
    const confidenceThreshold = 0.75;
    const holdTime = 2000;
    const cooldown = 3000;
    const bufferSize = 5;
    const displayHoldDuration = 5000;

    const holdStart = {};
    const lastPlayed = {};
    const predictionBuffer = {};
    let currentDetectedClass = null;

    const imageDiv = document.getElementById("image-display");
    const predictionDiv = document.getElementById("prediction");

    // --- Initialize webcam ---
    try {
        webcam = new tmPose.Webcam(400, 300, true, { facingMode: "user" });
        await webcam.setup();
        await webcam.play();
        document.getElementById("webcam-container").appendChild(webcam.canvas);
        console.log("Webcam ready!");
    } catch (err) {
        console.error("Webcam initialization failed:", err);
        predictionDiv.innerText = "Webcam initialization failed!";
        return;
    }

    // --- Load model ---
    try {
        model = await tmPose.load(URL + "model.json", URL + "metadata.json");
        console.log("Model loaded!");
        predictionDiv.innerText = "Model loaded!";
    } catch (err) {
        console.error("Model loading failed:", err);
        predictionDiv.innerText = "Model loading failed!";
        return;
    }

    // --- Main loop ---
    async function loop() {
        webcam.update();
        if (model) await predict();
        requestAnimationFrame(loop);
    }

    async function predict() {
        try {
            const { pose, posenetOutput } = await model.estimatePose(webcam.canvas);
            if (!pose || !posenetOutput) return;

            const predictions = await model.predict(posenetOutput);
            console.log("Predictions:", predictions);

            if (predictions.length === 0) {
                predictionDiv.innerText = "No predictions";
                return;
            }

            const highest = predictions.reduce((a, b) => a.probability > b.probability ? a : b);
            const className = highest.className.trim();
            const prob = highest.probability;

            // Rolling buffer
            if (!predictionBuffer[className]) predictionBuffer[className] = [];
            predictionBuffer[className].push(prob);
            if (predictionBuffer[className].length > bufferSize) predictionBuffer[className].shift();
            const avgProb = predictionBuffer[className].reduce((a, b) => a + b, 0) / predictionBuffer[className].length;

            const now = Date.now();

            // --- Detection logic ---
            if (avgProb >= confidenceThreshold) {
                if (!holdStart[className]) holdStart[className] = now;

                if (now - holdStart[className] >= holdTime) {
                    if (!lastPlayed[className] || now - lastPlayed[className] > cooldown) {
                        lastPlayed[className] = now;

                        if (sounds[className]) sounds[className].play();
                        imageDiv.innerHTML = `<img src="${images[className]}" alt="${className}">`;
                        currentDetectedClass = className;

                        setTimeout(() => {
                            if (images["Completed"]) {
                                imageDiv.innerHTML = `<img src="${images["Completed"]}" alt="Completed">`;
                            }
                        }, 500);

                        setTimeout(() => {
                            imageDiv.innerHTML = `<img src="${images["Neutral"]}" alt="Neutral">`;
                            currentDetectedClass = null;
                        }, displayHoldDuration);
                    }
                    holdStart[className] = null;
                }
            } else {
                holdStart[className] = null;
                if (!currentDetectedClass) {
                    imageDiv.innerHTML = `<img src="${images["Neutral"]}" alt="Neutral">`;
                }
            }

            // Update prediction text
            predictionDiv.innerText =
                avgProb >= confidenceThreshold
                    ? `Detected: ${className} (${(avgProb * 100).toFixed(2)}%)`
                    : "No detection";

        } catch (err) {
            console.error("Prediction failed:", err);
            predictionDiv.innerText = "Prediction error! See console.";
        }
    }

    loop();
})();