const api_key = 'TODO: replace with your API key'; 
const patternpal = new PatternPal(api_key);

function prettyPrintList(list) {
  return list.map((item, i) => `\n${i+1}. ${item}`);
}

// mock the solutions
patternpal.solutions = [
  `^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$`,
  `^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$`,
  `^(?:[a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)*)@[a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)+$`,
  `^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]{2,}$`,
  `^[\w\d._%+-]+@(?:[\w\d-]+\.)+\w{2,}$`,
].map(regString => new RegExp(regString));

// mock the tests
patternpal.tests = [
  (regex) => {
  // Explanation: A valid email address must have a "@" symbol
  return regex.test("test@example.com");
  },
  (regex) => {
  // Explanation: A valid email address must have a "." symbol
  return regex.test("john.doe123@gmail.com");
  },
  (regex) => {
  // Explanation: A valid email address must end with a valid domain name
  return regex.test("jane@company.co.uk");
  },
  (regex) => {
  // Explanation: A valid email address must not have spaces
  return regex.test("user123@example-domain.net");
  },
  (regex) => {
  // Explanation: A valid email address must not have spaces
  return !regex.test("first. last@subdomain. example.com");
  },
  (regex) => {
  // Explanation: An empty string is not a valid email address
  return !regex.test("");
  },
  (regex) => {
  // Explanation: An email address must contain the "a" symbol
  return !regex.test("test.example.com");
  },
  (regex) => {
  // Explanation: The domain part of an email address must be a valid domain name
  return !regex.test("test@example.123");
  },
  (regex) => {
  // Explanation: An email address should have exactly one "@" symbol
  return !regex.test ("test@example@example.com");
  },
  (regex) => {
  // Explanation: The local part of an email address should not contain special characters like "$"
  return !regex.test ("te$st@example.com");
  },
];

// test the solutions
patternpal.testSolutions();

// determine the best solution
patternpal.determineBestSolution();

// determine the best tests
patternpal.determineBestTests();

console.log(`The best solution is: ${patternpal.getBestSolution()}.`);
console.log(`The best tests are: ${prettyPrintList(patternpal.getBestTests())}.`);
console.log(`The other tests that the best solution passes are: ${prettyPrintList(patternpal.getTestsPassedByBestSolution())}`);
console.log(`The tests that the best solution fails are: ${prettyPrintList(patternpal.getTestsFailedByBestSolution())}`);