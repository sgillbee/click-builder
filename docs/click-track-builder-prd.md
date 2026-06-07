# Click track video builder prd
Click track video builder is an application that allows converts existing lyric videos (for church VBS for example) into click-track videos that the music can be played live, but the band is synced with the lyrics animated in the video.

The video is pre-existing. We need to create the click track audio and then combine it with the existing video to create a new video with the click track audio. The click track audio will be used by the band to play along with the video, which will have the lyrics animated in sync with the music.

This is intended to be a CLI application that can be run on a local machine. It will take in the existing video file, the tempo/time-signature, the song structure, and the wav fragments for the click/metronome sounds and counting/section markers. It will then output a new video file with the click track audio combined with the existing video.

* **Architecture (Unix Philosophy):** The application MUST be built as a suite of small, composable CLI tools rather than a massive monolith. Output from one phase feeds as input into the next (e.g., config parser -> timeline generator -> audio renderer -> video muxer).
  * This allows mixing stacks (e.g., Node.js for orchestration and parsing, Python for audio analysis) so long as they communicate via standard formats (like JSON stdout/stdin).
* **Detailed Logging:** Every phase and tool must emit detailed, diagnostic logs to cleanly track data transformations and troubleshoot math or FFmpeg issues.
* **Tech Stack:** Open to a hybrid Node.js (TypeScript) and/or Python approach. Pick the best ecosystem for each specific micro-tool in the pipeline.
* **Build/Tooling:** Modern tooling (Vite/Rspack ecosystem for TS, standard requirements for Python).
* **Testing [CRITICAL]:** Unit testing per tool. Crucially, a BDD/GWT (Given/When/Then) test runner (like Cucumber or Playwright's test runner adapted for integration) MUST be used to enforce requirements and validate the end-to-end integration of the pipeline.
* **Media Processing:** FFmpeg (via a wrapper like `fluent-ffmpeg` or spawned processes) for all media multiplexing and audio timeline generation.

Here are some details:

* I have information about the musical tempo/time-signature (eg: 139 6/8 or 72 4/4).
* I know how long the song is (how may measures).
* I know song structure (intro, verse, chorus, bridge, interlude, outro, etc). The structure configuration MUST support mid-song meter changes (e.g., jumping from 4/4 to a measure of 2/4, then back to 4/4) so the click track doesn't drift if there's a time-signature anomaly.
* I have wav fragments (from Ableton Live) for different click/metronome sounds. I also have wav fragments for counting ("one", "two", "three", etc) and also for sections ("chorus", "verse one", "bridge two", etc).
* It is optional, but nice to have, to have these section markers in the click track. I'm happy with just a count-in and metronome. Typically, click tracks start with a measure of metronome clicks then over the top of the next measure is a count-in "Intro two three four".
* Metronome should be click should be on quarter notes for 4/4. For 6/8 is could be in 6, in 4, or in 2 depending on the song. This should be a user input. Some kind of metronome audio preview would be nice.
* I'm happy for this to be a multi-step process. For example, the first step could be to generate the click track audio file based on the tempo, time signature, song structure, and wav fragments. The second step could be to combine the click track audio with the existing video to create the final output video.
* The output video should NOT reencode the existing video. It should just combine the existing video with the new click track audio. This is important to preserve the quality of the original video and to make the process faster.
* The application should be able to handle different video formats (mp4, mov, etc) and audio formats (wav, mp3, etc) for the input files.
* The application should be able to output the final video in a common format (mp4, mov, etc) that can be easily played on different devices.
* The application should have error handling for cases where the input files are not in the correct format or if there are issues with the audio or video processing.
* The application should have a simple command-line interface directly driven by a configuration file (YAML preferred). This allows configs to be easily stored in git, iterated upon, and used for batch continuous creation. The YAML config will define paths, base tempo/time-signature, and detailed song structure.
* The application should be well-documented, with clear instructions on how to use it and what the expected input and output formats are.
* **Video Sync Offset & Downbeat Alignment:** Because we add measures of click/count-in to the front, the existing video must be shifted dynamically to align the audio count-in with the actual start of the music in the video.
  * For the MVP, we will rely on a **manual downbeat timecode** provided by the user in the YAML config (e.g., the exact millisecond the song actually starts in the video).
  * We will use an input timestamp offset (e.g., FFmpeg `-itsoffset`) to prevent re-encoding, offsetting the video stream relative to the calculated audio wait time.
  * The architecture MUST be designed modularly here. If automatic MIR (Music Information Retrieval) downbeat detection is added in the future, it just becomes a new tool in the pipeline that injects the timecode.
