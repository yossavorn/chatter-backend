export class Helper {
  static toFirstLetterUpperCase(target: string) {
    const lowerCase = target.toLowerCase();
    return lowerCase
      .split(' ')
      .map((v) => {
        return `${v.charAt(0).toUpperCase()}${v.slice(1)}`;
      })
      .join(' ');
  }

  static toLowerCase(target: string) {
    return target.toLowerCase();
  }

  static generateRandomIntegers(length: number): number {
    const char = '0123456789';
    let randomNumber = '';

    // Generate a random number of the specified length
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * char.length);
      randomNumber += char[randomIndex];
    }

    // Convert the result string to a number (removes leading zeroes if any)
    return parseInt(randomNumber, 10);
  }

  static parseJson(prop: string) {
    try {
      return JSON.parse(prop);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      return prop; // Return the original string if parsing fails
    }
  }
}
