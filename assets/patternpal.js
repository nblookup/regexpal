class PatternPalInternalError extends Error {
  constructor(message, error) {
    super(message);
    this.name = "PatternPalInternalError";
    this.error = error;
  }
}

class PatternPalError extends Error {
  constructor(message) {
    super(message);
    this.name = "PatternPalError";
  }
}

class PatternPal {

  NUM_SOLUTIONS = 10;
  NUM_TESTS = 5;
  TESTS_TO_SHOW = 2;

  // String OpenAI API key.
  api_key;
  // String prompt.
  prompt;
  // Boolean[][] results of running each test on each solution. Rows are solutions, columns are tests, so results[i][j] is the result of running test j on solution i.
  results;
  // RegExpr[] solutions.
  solutions;
  // number index of the best solution in the solutions array.
  best_solution;
  // number[] indices of the best test in the tests array.
  best_tests;
  // String[] tests.
  tests;

  constructor(api_key) {
    this.api_key = api_key;
  }

  /**
   * Private methods
   */

  async queryGPT3(system_message, prompt) {
    const t = this;
    const url = 'https://api.openai.com/v1/chat/completions';
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${t.api_key}`
    };
    const data = {
      "model": "gpt-3.5-turbo",
      "messages": [
        {
          "role": "system",
          "content": system_message
        },
        {
          "role": "user",
          "content": prompt
        }
      ],
      "temperature": 1,
      "max_tokens": 1000,
      "top_p": 1,
      "frequency_penalty": 0,
      "presence_penalty": 0
    };
  
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(data)
      });
  
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
  
      const jsonResponse = await response.json();
      return jsonResponse.choices[0].message.content;
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  // Parse solution by parsing a markdown list into an array of regexprs. Works with both ordered and unordered lists.
  parseSolutionsResponse(markdown_list) {
    try {
      // Remove leading and trailing whitespace
      markdown_list = markdown_list.trim();

      // Remove the list markers (* or 1.)
      markdown_list = markdown_list.replace(/^\s*[\*\d]\.\s*/gm, '');

      // Split the markdown list into an array
      const array = markdown_list.split('\n');

      // Remove leading and trailing whitespace from each item
      const trimmedArray = array.map(item => item.trim());

      // Convert into RegExprs
      const regexprArray = trimmedArray.map(item => new RegExp(item));

      return regexprArray;
    } catch (e) {
      throw new PatternPalInternalError("Error parsing solutions response", e);
    }
  }
  
  // Parses the response from the LLM into an array of tests.
  parseTestsResponse(stringResponse) {
    try {
      const f = new Function(stringResponse);
      return f();
    } catch (e) {
      throw new PatternPalInternalError("Error parsing tests response", e);
    }
  }

  // System message for generating `n` solutions.
  getSolutionSystemMessage(n) {
    return `Generate a markdown list of just ${n} regular expressions.`;
  }

  // System message for generating `n` tests. Polarity is a boolean. Either positive tests ("things that should match") or negative tests ("things that should not match").
  getTestSystemMessage(n, polarity) {
    return `Generate ${n} ${polarity ? "positive" : "negative"} tests. Each test is written as vanilla javascript anonymous functions of the type: “"(regex: string) => boolean”. Format your output exactly like so:
    \`\`\`
    return [
      (regex) => {
        // Explanation of test 1
        ...
      },
      (regex) => {
        // Explanation of test 2
        ...
      }
    ]
    \`\`\``;
  }

  // Grabs NUM_SOLUTIONS solutions for the current prompt and stores them in the class.
  async queryForSolutions() {
    const system_message = this.getSolutionSystemMessage(this.NUM_SOLUTIONS);
    const response = await this.queryGPT3(system_message, this.prompt);
    this.solutions = this.parseSolutionsResponse(response);
  }

  // Grabs NUM_TESTS positive tests and NUM_TESTS negative tests for the current prompt and stores them in the class.
  async queryForTests() {
    this.tests = [];
    {
      const system_message = this.getTestSystemMessage(this.NUM_TESTS, true);
      const response = await this.queryGPT3(system_message, this.prompt);
      this.tests = this.tests.concat(this.parseTestsResponse(response));
    }
    {
      const system_message = this.getTestSystemMessage(this.NUM_TESTS, false);
      const response = await this.queryGPT3(system_message, this.prompt);
      this.tests = this.tests.concat(this.parseTestsResponse(response));
    }
  }

  // Returns the result of test(solution). If error, returns false.
  tryTest(test, solution) {
    try {
      return test(solution);
    } catch (e) {
      return false;
    }
  }

  // Runs the tests on the solutions and stores the results.
  testSolutions() {
    this.results = [];
    // Run each solution...
    for (let i = 0; i < this.solutions.length; i++) {
      this.results[i] = [];
      // ...on each test...
      for (let j = 0; j < this.tests.length; j++) {
        // ...and store the result
        this.results[i][j] = this.tryTest(this.tests[j], this.solutions[i]);
      }
    }
  }

  // Returns the index of the row with the most trues given a matrix of booleans.
  indexOfRowWithMostTrues(matrix) {
    return matrix.reduce((maxIndex, row, currentIndex) =>
      row.reduce((count, value) => count + value, 0) >
      matrix[maxIndex].reduce((count, value) => count + value, 0)
        ? currentIndex
        : maxIndex,
      0
    );
  }

  // Determines the best solution and stores it in the class.
  determineBestSolution() {
    // The best solution is the one that passes the most tests.
    this.best_solution = this.indexOfRowWithMostTrues(this.results);
  }

  // distinguishing_score(test) = # solutions that fail / # solutions that pass
  distinguishing_score(test_index) {
    let num_solutions = this.solutions.length;
    let num_solutions_that_pass = this.results.reduce((count, row) => count + row[test_index], 0);
    let num_solutions_that_fail = num_solutions - num_solutions_that_pass;
    let score = num_solutions_that_fail / num_solutions_that_pass;
    console.log(`Test ${test_index} has a distinguishing score of ${score} because it fails on ${num_solutions_that_fail} solutions and passes on ${num_solutions_that_pass} solutions.`)
    return score;
  }

  // The best tests are the top TESTS_TO_SHOW tests for the best solution.
  determineBestTests() {
    // [0 ... tests.length - 1]
    let test_indices = [...Array(this.tests.length).keys()];
    // First, we remove the tests that the best solution fails on.
    test_indices = test_indices.filter(test_index => this.results[this.best_solution][test_index]);
    // With the remaining tests, we calculate their distinguishing scores.
    let scores = test_indices.map(test_index => {return {
      index: test_index,
      score: this.distinguishing_score(test_index)
    }});
    // Sort the tests by their scores in descending order
    scores.sort((a, b) => b.score - a.score);
    // Take the top TESTS_TO_SHOW tests
    this.best_tests = scores.slice(0, this.TESTS_TO_SHOW).map(score => score.index);
  }

  /**
   * Public API
   */

  setPrompt(prompt) {
    this.prompt = prompt;
  }

  getPrompt() {
    return this.prompt;
  }

  getBestSolution() {
    return this.solutions[this.best_solution].toString();
  }

  getAllSolutions() {
    return this.solutions;
  }

  getBestTests() {
    return this.best_tests.map(test_index => this.tests[test_index].toString())
  }

  getTests() {
    return this.tests;
  }

  // Returns a list of tests that the best solution passes in string form.
  getTestsPassedByBestSolution() {
    // Tests that the best solution passes are the ones that are true in the best solution's row.
    return this.results[this.best_solution].map((result, i) => result ? this.tests[i].toString() : null).filter(test => test);
  }

  // Returns a list of tests that the best solution fails in string form.
  getTestsFailedByBestSolution() {
    // Tests that the best solution fails are the ones that are false in the best solution's row.
    return this.results[this.best_solution].map((result, i) => !result ? this.tests[i].toString() : null).filter(test => test);
  }

  // Queries the LLM for the solutions and tests for the current prompt and stores the results in the class.
  async query() {
    // Query for solutions
    try {
      await this.queryForSolutions();
    } catch (e) {
      throw new PatternPalError("Error querying for solutions", e);
    }
    // Query for tests
    try {
      await this.queryForTests();
    } catch (e) {
      throw new PatternPalError("Error querying for tests", e);
    }
    // Run tests on solutions.
    this.testSolutions();
    // Determine the best solution.
    this.determineBestSolution();
    // Determine the best tests for the best solution.
    this.determineBestTests();
  }
}