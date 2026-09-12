/** Bound raw parent requests before interpretation; never truncate into another task. */
export const ASK_QUESTION_MAX_LENGTH=500;
export function validateAskQuestion(value:unknown):string {
 if(typeof value!=='string'||!value.trim()||value.length>ASK_QUESTION_MAX_LENGTH||/[\u0000-\u001f\u007f]/.test(value))throw new Error('invalid_research_question');
 return value.trim();
}
