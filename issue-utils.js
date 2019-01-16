/*jshint esversion: 6 */
/*jshint node: true */

/**
 * Contains utils mimicing the issuance functionality needed
 * from background.js at https://github.com/privacypass/challenge-bypass-extension
 */

"use strict";
const utils = require('./utils.js');
const funcs = utils.funcs;
const url = require('url');

// Parse the marshaled response from the server
function parseIssueResponse(data, tokens) {
    let formattedData = 'signatures=' + data;
    funcs.validateResponse(url.parse('example.com'), '1', formattedData, tokens);
}

// Generates n tokens and returns a wrapped issue request
function GenerateWrappedIssueRequest(n) {
    console.time('token-gen');
	const tokens = funcs.GenerateNewTokens(n);
    console.timeEnd('token-gen');
    console.time('issue-req');
	const issueReq = funcs.BuildIssueRequest(tokens);
    console.timeEnd('issue-req');
	return {wrap: WrapIssueRequest(issueReq), tokens: tokens};
}

// Wraps an issue request in the format needed for the
// server
function WrapIssueRequest(issueReqB64) {
	return JSON.stringify({ "bl_sig_req": issueReqB64 });
}

module.exports = {
	GenerateWrappedIssueRequest: GenerateWrappedIssueRequest,
	parseIssueResponse: parseIssueResponse,
};
