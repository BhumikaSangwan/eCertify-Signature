export const generateMongooseDuplicateKeyMessage = (mongooseError) => {
    let message = Object.entries(mongooseError?.keyValue ?? {}).reduce((result, [key, value]) => {
        result += `Key: ${key} for value: ${JSON.stringify(value)} `
        console.log("mongoose res : ", result);
        return result;
    }, '');
    return `Error: Duplicate entries ${message}`;
}