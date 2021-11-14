export = readability;

declare const readability: Readability;
declare class Readability {
    [key: string]: any;

    static getGradeSuffix(grade: number): string;
    static split(text: string): string | string[];
    charCount(text: string, ignoreSpaces?: boolean): number;
    letterCount(text: string, ignoreSpaces?: boolean): number;
    removePunctuation(text: string): number;
    lexiconCount(text: string, removePunctuation?: boolean): number;
    syllableCount(text: string, lang?: boolean): number;
    sentenceCount(text: string): number;
    averageSentenceLength(text: string): number;
    averageSyllablePerWord(text: string): number;
    averageCharacterPerWord(text: string): number;
    averageLetterPerWord(text: string): number;
    averageSentencePerWord(text: string): number;
    fleschReadingEase(text: string): number;
    fleschReadingEaseToGrade(score: number): 5 | 6 | 7 | 8.5 | 11 | 13 | 15 | 16;
    fleschKincaidGrade(text: string): number;
    polySyllableCount(text: string): number;
    smogIndex(text: string): number;
    colemanLiauIndex(text: string): number;
    automatedReadabilityIndex(text: string): number;
    linsearWriteFormula(text: string): number;
    presentTense(word: number): number;
    difficultWords(text: string, syllableThreshold?: boolean): number | Set<string>;
    daleChallReadabilityScore(text: string): number;
    daleChallToGrade(score: number): 5 | 7 | 11 | 13 | 16 | 4 | 9;
    gunningFog(text: string): number;
    lix(text: string): number;
    rix(text: string): number;
    textStandard(text: string, floatOutput?: boolean): string;
    textMedian(text: string): number;
}
