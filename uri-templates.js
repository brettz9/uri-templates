(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.UriTemplate = factory());
})(this, (function () { 'use strict';

	const uriTemplateGlobalModifiers = {
		"+": true,
		"#": true,
		".": true,
		"/": true,
		";": true,
		"?": true,
		"&": true
	};
	const uriTemplateSuffices = {
		"*": true
	};

	function notReallyPercentEncode(string) {
		return encodeURI(string).replace(/%25[0-9][0-9]/g, function (doubleEncoded) {
			return "%" + doubleEncoded.substring(3);
		});
	}

	function uriTemplateSubstitution(spec) {
		let modifier = "";
		if (uriTemplateGlobalModifiers[spec.charAt(0)]) {
			modifier = spec.charAt(0);
			spec = spec.substring(1);
		}
		let separator = "";
		let prefix = "";
		let shouldEscape = true;
		let showVariables = false;
		let trimEmptyString = false;
		if (modifier == '+') {
			shouldEscape = false;
		} else if (modifier == ".") {
			prefix = ".";
			separator = ".";
		} else if (modifier == "/") {
			prefix = "/";
			separator = "/";
		} else if (modifier == '#') {
			prefix = "#";
			shouldEscape = false;
		} else if (modifier == ';') {
			prefix = ";";
			separator = ";",
			showVariables = true;
			trimEmptyString = true;
		} else if (modifier == '?') {
			prefix = "?";
			separator = "&",
			showVariables = true;
		} else if (modifier == '&') {
			prefix = "&";
			separator = "&",
			showVariables = true;
		}

		const varNames = [];
		const varList = spec.split(",");
		const varSpecs = [];
		const varSpecMap = {};
		for (let i = 0; i < varList.length; i++) {
			let varName = varList[i];
			let truncate = null;
			if (varName.indexOf(":") != -1) {
				const parts = varName.split(":");
				varName = parts[0];
				truncate = parseInt(parts[1]);
			}
			const suffices = {};
			while (uriTemplateSuffices[varName.charAt(varName.length - 1)]) {
				suffices[varName.charAt(varName.length - 1)] = true;
				varName = varName.substring(0, varName.length - 1);
			}
			const varSpec = {
				truncate,
				name: varName,
				suffices
			};
			varSpecs.push(varSpec);
			varSpecMap[varName] = varSpec;
			varNames.push(varName);
		}
		const subFunction = function (valueFunction) {
			let result = "";
			let startIndex = 0;
			for (let i = 0; i < varSpecs.length; i++) {
				const varSpec = varSpecs[i];
				let value = valueFunction(varSpec.name);
				if (value == null || (Array.isArray(value) && value.length == 0) || (typeof value == 'object' && Object.keys(value).length == 0)) {
					startIndex++;
					continue;
				}
				if (i == startIndex) {
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
							result += varSpec.suffices['*'] ? (separator || ",") : ",";
							if (varSpec.suffices['*'] && showVariables) {
								result += varSpec.name + "=";
							}
						}
						result += shouldEscape ? encodeURIComponent(value[j]).replace(/!/g, "%21") : notReallyPercentEncode(value[j]);
					}
				} else if (typeof value == "object") {
					if (showVariables && !varSpec.suffices['*']) {
						result += varSpec.name + "=";
					}
					let first = true;
					for (const key in value) {
						if (!first) {
							result += varSpec.suffices['*'] ? (separator || ",") : ",";
						}
						first = false;
						result += shouldEscape ? encodeURIComponent(key).replace(/!/g, "%21") : notReallyPercentEncode(key);
						result += varSpec.suffices['*'] ? '=' : ",";
						result += shouldEscape ? encodeURIComponent(value[key]).replace(/!/g, "%21") : notReallyPercentEncode(value[key]);
					}
				} else {
					if (showVariables) {
						result += varSpec.name;
						if (!trimEmptyString || value != "") {
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
		const guessFunction = function (stringValue, resultObj) {
			if (prefix) {
				if (stringValue.substring(0, prefix.length) == prefix) {
					stringValue = stringValue.substring(prefix.length);
				} else {
					return null;
				}
			}
			if (varSpecs.length == 1 && varSpecs[0].suffices['*']) {
				const varSpec = varSpecs[0];
				const varName = varSpec.name;
				const arrayValue = varSpec.suffices['*'] ? stringValue.split(separator || ",") : [stringValue];
				let hasEquals = (shouldEscape && stringValue.indexOf('=') != -1);	// There's otherwise no way to distinguish between "{value*}" for arrays and objects
				for (let i = 1; i < arrayValue.length; i++) {
					const stringValue = arrayValue[i];
					if (hasEquals && stringValue.indexOf('=') == -1) {
						// Bit of a hack - if we're expecting "=" for key/value pairs, and values can't contain "=", then assume a value has been accidentally split
						arrayValue[i - 1] += (separator || ",") + stringValue;
						arrayValue.splice(i, 1);
						i--;
					}
				}
				for (let i = 0; i < arrayValue.length; i++) {
					const stringValue = arrayValue[i];
					if (shouldEscape && stringValue.indexOf('=') != -1) {
						hasEquals = true;
					}
					const innerArrayValue = stringValue.split(",");
					for (let j = 0; j < innerArrayValue.length; j++) {
						if (shouldEscape) {
							innerArrayValue[j] = decodeURIComponent(innerArrayValue[j]);
						}
					}
					if (innerArrayValue.length == 1) {
						arrayValue[i] = innerArrayValue[0];
					} else {
						arrayValue[i] = innerArrayValue;
					}
				}

				if (showVariables || hasEquals) {
					const objectValue = resultObj[varName] || {};
					for (let j = 0; j < arrayValue.length; j++) {
						let innerValue = stringValue;
						if (showVariables && !innerValue) {
							// The empty string isn't a valid variable, so if our value is zero-length we have nothing
							continue;
						}
	          let innerVarName;
						if (typeof arrayValue[j] == "string") {
							let stringValue = arrayValue[j];
							innerVarName = stringValue.split("=", 1)[0];
							stringValue = stringValue.substring(innerVarName.length + 1);
							innerValue = stringValue;
						} else {
							let stringValue = arrayValue[j][0];
							innerVarName = stringValue.split("=", 1)[0];
							stringValue = stringValue.substring(innerVarName.length + 1);
							arrayValue[j][0] = stringValue;
							innerValue = arrayValue[j];
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
					if (Object.keys(objectValue).length == 1 && objectValue[varName] !== undefined) {
						resultObj[varName] = objectValue[varName];
					} else {
						resultObj[varName] = objectValue;
					}
				} else {
					if (resultObj[varName] !== undefined) {
						if (Array.isArray(resultObj[varName])) {
							resultObj[varName] = resultObj[varName].concat(arrayValue);
						} else {
							resultObj[varName] = [resultObj[varName]].concat(arrayValue);
						}
					} else {
						if (arrayValue.length == 1 && !varSpec.suffices['*']) {
							resultObj[varName] = arrayValue[0];
						} else {
							resultObj[varName] = arrayValue;
						}
					}
				}
			} else {
				const arrayValue = (varSpecs.length == 1) ? [stringValue] : stringValue.split(separator || ",");
				const specIndexMap = {};
				for (let i = 0; i < arrayValue.length; i++) {
					// Try from beginning
					let firstStarred = 0;
					for (; firstStarred < varSpecs.length - 1 && firstStarred < i; firstStarred++) {
						if (varSpecs[firstStarred].suffices['*']) {
							break;
						}
					}
					if (firstStarred == i) {
						// The first [i] of them have no "*" suffix
						specIndexMap[i] = i;
						continue;
					} else {
						// Try from the end
	                    let lastStarred;
						for (lastStarred = varSpecs.length - 1; lastStarred > 0 && (varSpecs.length - lastStarred) < (arrayValue.length - i); lastStarred--) {
							if (varSpecs[lastStarred].suffices['*']) {
								break;
							}
						}
						if ((varSpecs.length - lastStarred) == (arrayValue.length - i)) {
							// The last [length - i] of them have no "*" suffix
							specIndexMap[i] = lastStarred;
							continue;
						}
					}
					// Just give up and use the first one
					specIndexMap[i] = firstStarred;
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
						varSpec = varSpecMap[varName] || varSpecs[0];
					} else {
						varSpec = varSpecs[specIndexMap[i]];
						varName = varSpec.name;
					}

					for (let j = 0; j < innerArrayValue.length; j++) {
						if (shouldEscape) {
							innerArrayValue[j] = decodeURIComponent(innerArrayValue[j]);
						}
					}

					if ((showVariables || varSpec.suffices['*'])&& resultObj[varName] !== undefined) {
						if (Array.isArray(resultObj[varName])) {
							resultObj[varName] = resultObj[varName].concat(innerArrayValue);
						} else {
							resultObj[varName] = [resultObj[varName]].concat(innerArrayValue);
						}
					} else {
						if (innerArrayValue.length == 1 && !varSpec.suffices['*']) {
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

	function UriTemplate(template) {
		if (!(this instanceof UriTemplate)) {
			return new UriTemplate(template);
		}
		const parts = template.split("{");
		const textParts = [parts.shift()];
		const prefixes = [];
		const substitutions = [];
		const unSubstitutions = [];
		let varNames = [];
		while (parts.length > 0) {
			const part = parts.shift();
			const spec = part.split("}")[0];
			const remainder = part.substring(spec.length + 1);
			const funcs = uriTemplateSubstitution(spec);
			substitutions.push(funcs.substitution);
			unSubstitutions.push(funcs.unSubstitution);
			prefixes.push(funcs.prefix);
			textParts.push(remainder);
			varNames = varNames.concat(funcs.substitution.varNames);
		}
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
		this.fromUri = function (substituted) {
			const result = {};
			for (let i = 0; i < textParts.length; i++) {
				const part = textParts[i];
				if (substituted.substring(0, part.length) !== part) {
					return undefined;
				}
				substituted = substituted.substring(part.length);
				if (i >= textParts.length - 1) {
					if (substituted == "") {
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
					if (offset == textParts.length - 2) {
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
		};
		this.varNames = varNames;
		this.template = template;
	}
	UriTemplate.prototype = {
		toString () {
			return this.template;
		},
		fillFromObject (obj) {
			return this.fill(obj);
		}
	};

	return UriTemplate;

}));
