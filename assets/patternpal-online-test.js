const api_key = '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'; 
const patternpal = new PatternPal(api_key);

function prettyPrintList(list) {
  return list.map((item, i) => `\n${i+1}. ${item}`);
}

patternpal.setPrompt("valid emails");

console.log("querying patternpal...");
patternpal.query().then(() => {
  console.log(`The best solution is: ${patternpal.getBestSolution()}.`);
  console.log(`The best tests are: ${prettyPrintList(patternpal.getBestTests())}.`);
  console.log(`The other tests that the best solution passes are: ${prettyPrintList(patternpal.getTestsPassedByBestSolution())}`);
  console.log(`The tests that the best solution fails are: ${prettyPrintList(patternpal.getTestsFailedByBestSolution())}`);
});