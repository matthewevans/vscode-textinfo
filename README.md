# textinfo README

Small VSCode Extension

## Features

- Displays the estimated reading time remaining for the current document
- For supported languages, comments will be detected and annotated to display the evaluated reading level, the following readability tests:
  - Flesch Kincaid Grade
  - Flesch Reading Ease (interpreted as a grade)
  - SMOG Index
  - Coleman Liau Index
  - Automated Readability Index
  - Dale Chall Readability Score
  - Linsear Write Formula
  - Gunning Fog Index

## Requirements

# `git clone https://github.com/matthewevans/vscode-textinfo.git`
# cd vscode-textinfo
# `npm install`
# Open folder in VSCode
# Press F5 to try it out.

## Extension Settings

This extension contributes the following settings:

* `textinfo.estimatedReadingTime`: Whether to show the estimated reading time.
* `textinfo.estimatedReadingLevel`: Whether to display the estimated reading level.
* `textinfo.multilineComments`: Whether the multiline comment highlighter should be active.
* `textinfo.highlightPlainText`: Whether the plaintext comment highlighter should be active

