/**
 * @callback GuessFunction
 * @param {string} stringValue
 * @param {{[key: string]: any}} resultObj
 */

/**
 * @typedef {((
 *   valueFunction: (name: string) => undefined|null|string|string[]|{[key: string]: string}
 * ) => string) & {
 *   varNames: string[]
 * }} SubFunction
 */

const uriTemplateGlobalModifiers = new Set([
	"+",
	"#",
	".",
	"/",
	";",
	"?",
	"&"
]);
const uriTemplateSuffices = new Set([
	"*"
]);

/**
 * @param {string} string
 */
function notReallyPercentEncode(string) {
	return encodeURI(string).replace(/%25[0-9][0-9]/g, function (doubleEncoded) {
		return "%" + doubleEncoded.substring(3);
	});
}

/**
 * @param {string} spec
 */
function uriTemplateSubstitution(spec) {
	let modifier = "";
	if (uriTemplateGlobalModifiers.has(spec.charAt(0))) {
		modifier = spec.charAt(0);
		spec = spec.substring(1);
	}
	let separator = "";
	let prefix = "";
	let shouldEscape = true;
	let showVariables = false;
	let trimEmptyString = false;
	if (modifier === '+') {
		shouldEscape = false;
	} else if (modifier === ".") {
		prefix = ".";
		separator = ".";
	} else if (modifier === "/") {
		prefix = "/";
		separator = "/";
	} else if (modifier === '#') {
		prefix = "#";
		shouldEscape = false;
	} else if (modifier === ';') {
		prefix = ";";
		separator = ";",
		showVariables = true;
		trimEmptyString = true;
	} else if (modifier === '?') {
		prefix = "?";
		separator = "&",
		showVariables = true;
	} else if (modifier === '&') {
		prefix = "&";
		separator = "&",
		showVariables = true;
	}

	const varNames = [];
	const varList = spec.split(",");

  /**
  * @typedef {{
  *   truncate: number|null
  *   name: string,
  *   suffices: Set<string>
  * }} VarSpec
  */

  /** @type {VarSpec[]} */
	const varSpecs = [];
	const varSpecMap = new Map();
	for (let i = 0; i < varList.length; i++) {
		let varName = varList[i];
		let truncate = null;
		if (varName.includes(":")) {
			const parts = varName.split(":");
			varName = parts[0];
			truncate = parseInt(parts[1]);
		}
		const suffices = new Set();
		while (uriTemplateSuffices.has(varName.charAt(varName.length - 1))) {
			suffices.add(varName.charAt(varName.length - 1));
			varName = varName.substring(0, varName.length - 1);
		}

    /** @type {VarSpec} */
		const varSpec = {
			truncate,
			name: varName,
			suffices
		};
		varSpecs.push(varSpec);
		varSpecMap.set(varName, varSpec);
		varNames.push(varName);
	}

  /** @type {SubFunction} */
	const subFunction = function (valueFunction) {
		let result = "";
		let startIndex = 0;
		for (let i = 0; i < varSpecs.length; i++) {
			const varSpec = varSpecs[i];
			let value = valueFunction(varSpec.name);
			if (value == null || (Array.isArray(value) && !value.length) || (typeof value === 'object' && !Object.keys(value).length)) {
				startIndex++;
				continue;
			}
			if (i === startIndex) {
				result += prefix;
			} else {
				result += (separator || ",");
			}
			if (Array.isArray(value)) {
				if (showVariables) {
					result += varSpec.name + "=";
				}
				for (let j = 0; j < value.length; j++) {
					if (j > 0) {
						result += varSpec.suffices.has('*') ? (separator || ",") : ",";
						if (varSpec.suffices.has('*') && showVariables) {
							result += varSpec.name + "=";
						}
					}
					result += shouldEscape ? encodeURIComponent(value[j]).replace(/!/g, "%21") : notReallyPercentEncode(value[j]);
				}
			} else if (typeof value === "object") {
				if (showVariables && !varSpec.suffices.has('*')) {
					result += varSpec.name + "=";
				}
				let first = true;
				for (const key of Object.keys(value)) {
					if (!first) {
						result += varSpec.suffices.has('*') ? (separator || ",") : ",";
					}
					first = false;
					result += shouldEscape ? encodeURIComponent(key).replace(/!/g, "%21") : notReallyPercentEncode(key);
					result += varSpec.suffices.has('*') ? '=' : ",";
					result += shouldEscape ? encodeURIComponent(value[key]).replace(/!/g, "%21") : notReallyPercentEncode(value[key]);
				}
			} else {
				if (showVariables) {
					result += varSpec.name;
					if (!trimEmptyString || value !== "") {
						result += "=";
					}
				}
				if (varSpec.truncate != null) {
					value = value.substring(0, varSpec.truncate);
				}
				result += shouldEscape ? encodeURIComponent(value).replace(/!/g, "%21"): notReallyPercentEncode(value);
			}
		}
		return result;
	};

  /** @type {GuessFunction} */
	const guessFunction = function (stringValue, resultObj) {
		if (prefix) {
			if (stringValue.substring(0, prefix.length) === prefix) {
				stringValue = stringValue.substring(prefix.length);
			} else {
				return null;
			}
		}
		if (varSpecs.length === 1 && varSpecs[0].suffices.has('*')) {
			const varSpec = varSpecs[0];
			const varName = varSpec.name;
			const arrayValue = varSpec.suffices.has('*') ? stringValue.split(separator || ",") : [stringValue];
			let hasEquals = (shouldEscape && stringValue.includes('='));	// There's otherwise no way to distinguish between "{value*}" for arrays and objects
			for (let i = 1; i < arrayValue.length; i++) {
				const stringValue = arrayValue[i];
				if (hasEquals && !stringValue.includes('=')) {
					// Bit of a hack - if we're expecting "=" for key/value pairs, and values can't contain "=", then assume a value has been accidentally split
					arrayValue[i - 1] += (separator || ",") + stringValue;
					arrayValue.splice(i, 1);
					i--;
				}
			}

      /** @type {(string|string[])[]} */
      const arrayValueNested = arrayValue;
			for (let i = 0; i < arrayValue.length; i++) {
				const stringValue = arrayValue[i];
				if (shouldEscape && stringValue.includes('=')) {
					hasEquals = true;
				}
				const innerArrayValue = stringValue.split(",");
				for (let j = 0; j < innerArrayValue.length; j++) {
					if (shouldEscape) {
						innerArrayValue[j] = decodeURIComponent(innerArrayValue[j]);
					}
				}
				if (innerArrayValue.length === 1) {
					arrayValueNested[i] = innerArrayValue[0];
				} else {
					arrayValueNested[i] = innerArrayValue;
				}
			}

			if (showVariables || hasEquals) {
				const objectValue = resultObj[varName] || {};
				for (let j = 0; j < arrayValueNested.length; j++) {
          /** @type {string|string[]} */
					let innerValue = stringValue;
					if (showVariables && !innerValue) {
						// The empty string isn't a valid variable, so if our value is zero-length we have nothing
						continue;
					}
          let innerVarName;
					if (typeof arrayValueNested[j] === "string") {
						let stringValue = /** @type {string} */ (arrayValueNested[j]);
						innerVarName = stringValue.split("=", 1)[0];
						stringValue = stringValue.substring(innerVarName.length + 1);
						innerValue = stringValue;
					} else {
						innerValue = /** @type {string[]} */ (arrayValueNested[j]);
						let stringValue = innerValue[0];
						innerVarName = stringValue.split("=", 1)[0];
						stringValue = stringValue.substring(innerVarName.length + 1);
						innerValue[0] = stringValue;
					}
					if (objectValue[innerVarName] !== undefined) {
						if (Array.isArray(objectValue[innerVarName])) {
							objectValue[innerVarName].push(innerValue);
						} else {
							objectValue[innerVarName] = [objectValue[innerVarName], innerValue];
						}
					} else {
						objectValue[innerVarName] = innerValue;
					}
				}
				if (Object.keys(objectValue).length === 1 && objectValue[varName] !== undefined) {
					resultObj[varName] = objectValue[varName];
				} else {
					resultObj[varName] = objectValue;
				}
			} else {
				if (resultObj[varName] !== undefined) {
					if (Array.isArray(resultObj[varName])) {
						resultObj[varName] = resultObj[varName].concat(arrayValueNested);
					} else {
						resultObj[varName] = [resultObj[varName]].concat(arrayValueNested);
					}
				} else {
					if (arrayValueNested.length === 1 && !varSpec.suffices.has('*')) {
						resultObj[varName] = arrayValueNested[0];
					} else {
						resultObj[varName] = arrayValueNested;
					}
				}
			}
		} else {
			const arrayValue = (varSpecs.length === 1) ? [stringValue] : stringValue.split(separator || ",");
			const specIndexMap = new Map();
			for (let i = 0; i < arrayValue.length; i++) {
				// Try from beginning
				let firstStarred = 0;
				for (; firstStarred < varSpecs.length - 1 && firstStarred < i; firstStarred++) {
					if (varSpecs[firstStarred].suffices.has('*')) {
						break;
					}
				}
				if (firstStarred === i) {
					// The first [i] of them have no "*" suffix
					specIndexMap.set(i, i);
					continue;
				} else {
					// Try from the end
          let lastStarred;
					for (lastStarred = varSpecs.length - 1; lastStarred > 0 && (varSpecs.length - lastStarred) < (arrayValue.length - i); lastStarred--) {
						if (varSpecs[lastStarred].suffices.has('*')) {
							break;
						}
					}
					if ((varSpecs.length - lastStarred) === (arrayValue.length - i)) {
						// The last [length - i] of them have no "*" suffix
						specIndexMap.set(i, lastStarred);
						continue;
					}
				}
				// Just give up and use the first one
				specIndexMap.set(i, firstStarred);
			}
			for (let i = 0; i < arrayValue.length; i++) {
				const stringValue = arrayValue[i];
				if (!stringValue && showVariables) {
					// The empty string isn't a valid variable, so if our value is zero-length we have nothing
					continue;
				}
				const innerArrayValue = stringValue.split(",");

        let varSpec;
        let varName;
				if (showVariables) {
					let stringValue = innerArrayValue[0]; // using innerArrayValue
					varName = stringValue.split("=", 1)[0];
					stringValue = stringValue.substring(varName.length + 1);
					innerArrayValue[0] = stringValue;
					varSpec = varSpecMap.get(varName) || varSpecs[0];
				} else {
					varSpec = varSpecs[specIndexMap.get(i)];
					varName = varSpec.name;
				}

				for (let j = 0; j < innerArrayValue.length; j++) {
					if (shouldEscape) {
						innerArrayValue[j] = decodeURIComponent(innerArrayValue[j]);
					}
				}

				if ((showVariables || varSpec.suffices.has('*'))&& resultObj[varName] !== undefined) {
					if (Array.isArray(resultObj[varName])) {
						resultObj[varName] = resultObj[varName].concat(innerArrayValue);
					} else {
						resultObj[varName] = [resultObj[varName]].concat(innerArrayValue);
					}
				} else {
					if (innerArrayValue.length === 1 && !varSpec.suffices.has('*')) {
						resultObj[varName] = innerArrayValue[0];
					} else {
						resultObj[varName] = innerArrayValue;
					}
				}
			}
		}
	};
	subFunction.varNames = varNames;
	return {
		prefix: prefix,
		substitution: subFunction,
		unSubstitution: guessFunction
	};
}

/**
 * @param {string} template
 */
function UriTemplate(template) {
	if (!(this instanceof UriTemplate)) {
		return new UriTemplate(template);
	}
	const parts = template.split("{");
	const textParts = [/** @type {string} */ (parts.shift())];

  /** @type {string[]} */
	const prefixes = [];

  /** @type {SubFunction[]} */
  const substitutions = [];

  /** @type {GuessFunction[]} */
	const unSubstitutions = [];

  /** @type {string[]} */
  let varNames = [];
	while (parts.length > 0) {
		const part = /** @type {string} */ (parts.shift());
		const spec = part.split("}")[0];
		const remainder = part.substring(spec.length + 1);
		const funcs = uriTemplateSubstitution(spec);
		substitutions.push(funcs.substitution);
		unSubstitutions.push(funcs.unSubstitution);
		prefixes.push(funcs.prefix);
		textParts.push(remainder);
		varNames = varNames.concat(funcs.substitution.varNames);
	}

	/**
   * @type {{
   *   (
   *     callback: (varName: string) => undefined | string | {[key: string]: string}
   *   ): string;
   *   (
   *     vars: {[key: string]: undefined | string | {[key: string]: string}}
   *   ): string
   * }}
   */
	this.fill = function (valueFunction) {
		if (valueFunction && typeof valueFunction !== 'function') {
			const value = valueFunction;
			valueFunction = function (varName) {
				return value[varName];
			};
		}

		let result = textParts[0];
		for (let i = 0; i < substitutions.length; i++) {
			const substitution = substitutions[i];
			result += substitution(valueFunction);
			result += textParts[i + 1];
		}
		return result;
	};

  /**
   * @param {string} substituted
   */
	this.fromUri = function (substituted) {
		const result = {};
		for (let i = 0; i < textParts.length; i++) {
			const part = textParts[i];
			if (substituted.substring(0, part.length) !== part) {
				return undefined;
			}
			substituted = substituted.substring(part.length);
			if (i >= textParts.length - 1) {
				if (substituted === "") {
					break;
				} else {
					return undefined;
				}
			}
			let nextPart = textParts[i + 1];
			let offset = i;
      let stringValue;
      // eslint-disable-next-line no-constant-condition -- Has breaks
			while (true) {
				if (offset === textParts.length - 2) {
					const endPart = substituted.substring(substituted.length - nextPart.length);
					if (endPart !== nextPart) {
						return undefined;
					}
					stringValue = substituted.substring(0, substituted.length - nextPart.length);
					substituted = endPart;
				} else if (nextPart) {
					const nextPartPos = substituted.indexOf(nextPart);
					stringValue = substituted.substring(0, nextPartPos);
					substituted = substituted.substring(nextPartPos);
				} else if (prefixes[offset + 1]) {
					let nextPartPos = substituted.indexOf(prefixes[offset + 1]);
					if (nextPartPos === -1) nextPartPos = substituted.length;
					stringValue = substituted.substring(0, nextPartPos);
					substituted = substituted.substring(nextPartPos);
				} else if (textParts.length > offset + 2) {
					// If the separator between this variable and the next is blank (with no prefix), continue onwards
					offset++;
					nextPart = textParts[offset + 1];
					continue;
				} else {
					stringValue = substituted;
					substituted = "";
				}
				break;
			}
			unSubstitutions[i](stringValue, result);
		}
		return result;
	}
	this.varNames = varNames;
	this.template = template;
}
UriTemplate.prototype = {
	toString () {
		return this.template;
	},

  /**
   * @type {(vars: {[key: string]: undefined|string|{[key: string]: string}}) => string}
   */
	fillFromObject (obj) {
		return this.fill(obj);
	}
};

export default UriTemplate;
