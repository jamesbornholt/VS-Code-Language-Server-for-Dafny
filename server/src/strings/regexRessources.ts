"use strict";

export class Verification {
    public static LogParseRegex = new RegExp(".*?\\((\\d+),(\\d+)\\):.*?(Error|Warning|Info).*?\\w?: (.*)");
    public static NumberOfProofObligations = new RegExp(".*?(\\d+).*?(proof).*?(obligations|obligation).*?(verified|error)");
    public static RelatedLocationRegex = new RegExp(".*?\\((\\d+),(\\d+)\\):.*?(Related location).*(\\w)?: (.*)");
}
