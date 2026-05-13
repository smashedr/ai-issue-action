import * as core from '@actions/core'
import * as github from '@actions/github'
import * as glob from '@actions/glob'
import { anthropic } from '@ai-sdk/anthropic'
import { google } from '@ai-sdk/google'
import { openai } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { readFileSync } from 'node:fs'
import { inspect } from 'node:util'

// Inputs
const inputs = {
  model: core.getInput('model', { required: true }),
  instructions: core.getInput('instructions'),
  file: core.getInput('file'),
  maxTokens: core.getInput('max_tokens'),
  // number: core.getInput('number'),
  token: core.getInput('token', { required: true }),
} as const

type Inputs = typeof inputs

async function main() /* NOSONAR */ {
  const version: string = process.env.GITHUB_ACTION_REF
    ? `\u001b[35;1m${process.env.GITHUB_ACTION_REF}`
    : '\u001b[33;1mSource'
  core.info(`🏳️ Starting AI Issue Action - ${version}`)

  // console.log('inputs:', inputs)

  console.log('github.context.repo:', { ...github.context.repo })
  console.log('github.context.issue.number:', github.context.issue.number)
  if (!github.context.issue.number) return core.setFailed('No Issue Number')

  const issue = github.context.payload.issue
  if (!issue) return core.setFailed('No Issue')
  core.startGroup(`Issue #${issue.number}`)
  console.log(issue)
  core.endGroup() // issue

  const title = issue.title
  console.log('Issue Title:', title)
  if (!title) return core.setFailed('No Issue Title')

  const body = issue.body
  core.startGroup('Issue Body')
  console.log(body)
  core.endGroup() // body
  if (!body) return core.setFailed('No Issue Body')

  const instructions = await getInstructions(inputs)
  core.startGroup('Instructions')
  console.log(JSON.stringify(instructions, null, 2))
  core.endGroup() // instructions
  if (!instructions.length) return core.setFailed('No Instructions')

  const model = getModel(inputs)
  console.log('Model:', model.modelId)
  if (!model.modelId) return core.setFailed('No Model')

  const maxTokens = Number.parseInt(inputs.maxTokens) || 2048
  console.log('Max Tokens:', maxTokens)

  const response = await generateText({
    prompt: body,
    system: instructions.join('\n'),
    model: model,
    maxOutputTokens: maxTokens,
    providerOptions: { openai: { serviceTier: 'flex', reasoningEffort: 'none' } },
  })

  core.startGroup('response')
  console.log(inspect(response, { depth: null }))
  core.endGroup() // response
  core.startGroup('usage')
  console.log(JSON.stringify(response.usage, null, 2))
  core.endGroup() // usage
  core.startGroup('text')
  console.log(response.text)
  core.endGroup() // text

  const octokit = github.getOctokit(inputs.token)
  const comment = await octokit.rest.issues.createComment({
    ...github.context.repo,
    issue_number: issue.number,
    body: response.text,
  })
  core.startGroup('comment')
  console.log(comment)
  core.endGroup() // comment

  // Set Outputs
  core.info('📩 Setting Outputs')
  core.setOutput('text', response.text)
  core.setOutput('usage', response.usage)
  core.setOutput('comment', comment.data)

  core.info(`✅ \u001b[32;1mFinished Success`)
}

function getModel(inputs: Inputs) {
  if (inputs.model.startsWith('gemini')) {
    return google(inputs.model)
  } else if (inputs.model.includes('gpt')) {
    return openai(inputs.model)
  } else {
    return anthropic(inputs.model)
  }
}

async function getInstructions(inputs: Inputs): Promise<string[]> {
  const results: string[] = []
  if (inputs.instructions) results.push(inputs.instructions)
  if (inputs.file) {
    const globber = await glob.create(inputs.file)
    for await (const file of globber.globGenerator()) {
      const text = readFileSync(file, 'utf8').trim()
      core.startGroup(file)
      console.log(text)
      core.endGroup() // body
      if (text) results.push(text)
    }
  }
  return results
}

// import { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods'
// type Octokit = ReturnType<typeof github.getOctokit>
// type IssueData = RestEndpointMethodTypes['issues']['get']['response']['data']
// async function getIssue(octokit: Octokit, inputs: Inputs): Promise<IssueData> {
//   if (inputs.number) {
//     const issue = await octokit.rest.issues.get({
//       ...github.context.repo,
//       issue_number: Number.parseInt(inputs.number),
//     })
//     console.log('issue:', issue)
//     return issue.data
//   } else {
//     return github.context.payload.issue
//   }
// }

try {
  await main()
} catch (e) {
  const message = e instanceof Error ? e.message : 'Unknown Error'
  core.setFailed(message)
}
