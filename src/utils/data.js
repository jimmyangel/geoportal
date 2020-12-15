import GitHub from 'github-api'

import { Octokit } from '@octokit/rest'

import axios from 'axios'
import base64 from 'base-64'
import utf8 from 'utf8'
import {adminConfig, dataConfig} from '~/utils/config'
import {makeColorTableParameter} from '~/utils/misc'

let parseString = require('xml2js').parseString


// This retrieves meta from the github cache
export async function getMetaEntries() {
  let response = await axios.get(dataConfig.metaBaseUrl + dataConfig.metaFileName)
  return response
}

// This gets the size of a file
export async function getFileSize(fileName) {
  let response = await axios.head(dataConfig.filesBaseUrl + dataConfig.filesDirectory + '/' + fileName)
  return response.headers['content-length']
}

// This gets the list of stored files
export function getListOfFiles() {
  return new Promise((resolve, reject) => {
    axios.get(dataConfig.filesBaseUrl + '?list-type=2&prefix=' + dataConfig.filesDirectory).then(response => {
      parseString(response.data, (err, result) => {
        if (result.ListBucketResult.Contents) {
          resolve(
            result.ListBucketResult.Contents.map(item => {
              return {name: item.Key[0].replace('files/', ''), size: item.Size[0], date: item.LastModified[0]}
            }).filter(el => el.name != '')
          )
        } else {
          resolve([])
        }
      })
    })
  })
}

// This retrieves live meta from github repo
export async function getMetaFromRepo(token, file) {
  let octokit = new Octokit({auth: token})

  let response
  let result = {file: file}

  try {
    response = await octokit.repos.getContent({
      owner: adminConfig.githubInfo.owner,
      repo: adminConfig.githubInfo.repo,
      path: dataConfig.metaDirectory + '/' + file + '.json',
      headers: {'If-None-Match': ''}
    })
  } catch (err) {
    if (err.status != 404) {
      throw err
    }
  }
  if (response !== undefined) {
    result = JSON.parse(utf8.decode(base64.decode(response.data.content)))
    // Need to unpack tileInfo back to object
    result.tileInfo = JSON.parse(result.tileInfo)
    result.sha = response.data.sha // Add the sha to enable update
  }
  return result
}

export async function getMetaListFromRepo(token) {
  let octokit = new Octokit({auth: token})

  let response
  let result = []

  try {
    response = await octokit.repos.getContent({
      owner: adminConfig.githubInfo.owner,
      repo: adminConfig.githubInfo.repo,
      path: dataConfig.metaDirectory,
      headers: {'If-None-Match': ''}
    })
  } catch (err) {
    if (err.status != 404) {
      throw err
    }
  }
  if (response !== undefined) result = response.data.map(item => {
    return {file: item.name.substr(0, item.name.lastIndexOf('.')), sha: item.sha}
  })
  return result
}

// This saves meta to the github repo
export async function saveMetaFromRepo(token, meta) {
  let octokit = new Octokit({auth: token})

  let sha = meta.sha
  delete meta.sha

  // Need to package tileInfo as a string
  meta.tileInfo = JSON.stringify(meta.tileInfo)

  let response = await octokit.repos.createOrUpdateFileContents({
    owner: adminConfig.githubInfo.owner,
    repo: adminConfig.githubInfo.repo,
    path: dataConfig.metaDirectory + '/' + meta.file + '.json',
    sha: sha,
    content: base64.encode(utf8.encode(JSON.stringify(meta, null, 2))),
    message: 'Updated meta'
  })

  return response
}

export async function deleteMetaListFromRepo(token, fileAndShaList) {
  let octokit = new Octokit({auth: token})

  let responses = []
  for (const fileAndSha of fileAndShaList) {
    let response = await octokit.repos.deleteFile({
      owner: adminConfig.githubInfo.owner,
      repo: adminConfig.githubInfo.repo,
      path: dataConfig.metaDirectory + '/' + fileAndSha.file + '.json',
      sha: fileAndSha.sha,
      message: 'Deleted meta'
    })
    responses.push(response)
  }

  return responses
}

export async function deleteItemsFromRepo(token, itemList) {
  let github = new GitHub({token: token})

  let responses = []
  for (const item of itemList) {
    let response = await github.getRepo(adminConfig.githubInfo.owner, adminConfig.githubInfo.repo).deleteFile('master', item)
    responses.push(response)
  }

  return responses
}

export async function getPresignedUrl(token, name, type) {
  let response = await axios.get('/.netlify/functions/get-presigned-url?token=' + token + '&name=' + name + '&type=' + type)
  return response
}

export async function uploadFileToS3(url, formData, uploadProgress) {
  let response = await axios({
    method: 'post',
    url: url,
    data: formData,
    onUploadProgress: uploadProgress
  })
  return response
}

export async function deleteFiles(token, files) {
  let response = await axios.get('/.netlify/functions/delete-files?token=' + token + '&files=' + encodeURIComponent(files))
  return response
}

export async function deleteObjects(token, objects) {
  let response = await axios.get('/.netlify/functions/delete-objects?token=' + token + '&objects=' + encodeURIComponent(objects))
  return response
}

export async function submitJob(token, job) {
  let funcUrl = '/.netlify/functions/submit-job?token=' + token + '&file=' + job.file + '&type=' + job.tileInfo.type
  if (job.tileInfo.type === 'raster') {
    funcUrl += '&ctable=' + makeColorTableParameter(job.tileInfo.colorTable)
    funcUrl += '&exact=' + ((job.tileInfo.gradient) ? 'gradient' : 'exact')
  }
  let response = await axios.get(funcUrl)
  return response
}

export async function getSurveyTemplateFromRepo(token) {
  let octokit = new Octokit({auth: token})
  let response
  let result = {}

  try {
    response = await octokit.repos.getContent({
      owner: adminConfig.githubInfo.owner,
      repo: adminConfig.githubInfo.repo,
      path: dataConfig.surveyTemplateName,
      headers: {'If-None-Match': ''}
    })
  } catch(err) {
    throw err
  }
  if (response !== undefined) {
    result = JSON.parse(utf8.decode(base64.decode(response.data.content)))
    result.sha = response.data.sha // Add the sha to enable update
  }
  return result
}

export async function saveSurveyTemplate(token, surveyTemplate) {
  let octokit = new Octokit({auth: token})

  let sha = surveyTemplate.sha
  delete surveyTemplate.sha

  let response = await octokit.repos.createOrUpdateFileContents({
    owner: adminConfig.githubInfo.owner,
    repo: adminConfig.githubInfo.repo,
    path: dataConfig.surveyTemplateName,
    sha: sha,
    content: base64.encode(utf8.encode(JSON.stringify(surveyTemplate, null, 2))),
    message: 'Updated survey template'
  })

  return response
}

export async function sendSurvey(survey, version) {
  let response = await axios.get(dataConfig.geoIpLookupUrl)
  survey.countryCode = response.data.country_code ? response.data.country_code : '??'
  response = await axios.put('/.netlify/functions/send-survey?version=' + version, survey)
  return response
}

export async function getFAQFromRepo(token) {
  let octokit = new Octokit({auth: token})
  let response
  let result = {}

  try {
    response = await octokit.repos.getContent({
      owner: adminConfig.githubInfo.owner,
      repo: adminConfig.githubInfo.repo,
      path: dataConfig.faqFileName,
      headers: {'If-None-Match': ''}
    })
  } catch(err) {
    throw err
  }
  if (response !== undefined) {
    result = JSON.parse(utf8.decode(base64.decode(response.data.content)))
    result.sha = response.data.sha // Add the sha to enable update
  }
  return result
}

export async function saveFAQ(token, FAQ) {
  let octokit = new Octokit({auth: token})

  let sha = FAQ.sha
  delete FAQ.sha

  let response = await octokit.repos.createOrUpdateFileContents({
    owner: adminConfig.githubInfo.owner,
    repo: adminConfig.githubInfo.repo,
    path: dataConfig.faqFileName,
    sha: sha,
    content: base64.encode(utf8.encode(JSON.stringify(FAQ, null, 2))),
    message: 'Updated FAQ'
  })

  return response
}

async function getNewsItem(key) {
  let response = await axios.get(dataConfig.filesBaseUrl + key)
  return response.data
}

export function getListOfNewsItems() {
  return new Promise((resolve, reject) => {
    axios.get(dataConfig.filesBaseUrl + '?list-type=2&prefix=' + dataConfig.newsDirectory + '/&delimiter=/').then(response => {
      parseString(response.data, (err, result) => {
        if (result.ListBucketResult.Contents) {
          let p = result.ListBucketResult.Contents.map((item) => {
            return getNewsItem(item.Key[0])
          })
          Promise.all(p).then((values) => {
            resolve(values)
          })
        } else {
          resolve([])
        }
      })
    })
  })
}

export async function getListOfNewsItemsFromRepo(token) {
  let octokit = new Octokit({auth: token})

  let response
  let result = []

  try {
    response = await octokit.repos.getContent({
      owner: adminConfig.githubInfo.owner,
      repo: adminConfig.githubInfo.repo,
      path: dataConfig.newsDirName,
      headers: {'If-None-Match': ''}
    })
  } catch (err) {
    if (err.status != 404) {
      throw err
    }
  }
  if (response === undefined) return result

  response.data.forEach(async item => {
    if (item.type === 'file') {

      let nI = await octokit.repos.getContent({
        owner: adminConfig.githubInfo.owner,
        repo: adminConfig.githubInfo.repo,
        path: item.path,
        headers: {'If-None-Match': ''}
      })

      result.push(JSON.parse(utf8.decode(base64.decode(nI.data.content))))
    }
  })

  return result
}

export async function getNewsItemThumb(token, key) {
  let github = new GitHub({token: token})

  let result = await github.getRepo(adminConfig.githubInfo.owner, adminConfig.githubInfo.repo).getContents('master', key)
  return 'data:image/' + key.substr(key.lastIndexOf('.') + 1) + ';base64,' + result.data.content
}

export async function saveNewsItemFromRepo(token, newsItem) {
  let github = new GitHub({token: token})

  // Save thumbnail if included
  if (newsItem.thumb && newsItem.thumb.startsWith('data:')) {
    let parts = newsItem.thumb.split(',')
    let info = parts[0].split(/[:;]/)
    let thumbKey = newsItem.key.replace(/news\//,'news/thumbs/') + '.' + info[1].split('/')[1]
    await github.getRepo(adminConfig.githubInfo.owner, adminConfig.githubInfo.repo).
      writeFile('master', thumbKey, parts[1], 'Saved news item thumbnail', {encode: false})
    newsItem.thumb = './' + thumbKey.replace(/news\//, '')
  }

  await github.getRepo(adminConfig.githubInfo.owner, adminConfig.githubInfo.repo).
    writeFile('master', newsItem.key, JSON.stringify(newsItem), 'Saved news item', {encode: true})

  return
}

export async function getAboutFromRepo(token) {

  let octokit = new Octokit({auth: token})

  let response
  let result = {}

  dataConfig.aboutLocItems.forEach(async item => {
    result[item.fieldName] = ''
    try {
      response = await octokit.repos.getContent({
        owner: adminConfig.githubInfo.owner,
        repo: adminConfig.githubInfo.repo,
        path: dataConfig.aboutDirName + item.filePath,
        headers: {'If-None-Match': ''}
      })
    } catch (err) {
      if (err.status != 404) {
        throw err
      }
    }
    if (response !== undefined) {
      result[item.fieldName] = utf8.decode(base64.decode(response.data.content))
      result[item.fieldName + '_sha'] = response.data.sha
    }

    // Yank frontmatter
    let idx = result[item.fieldName].substr(4).indexOf('---\n')
    idx = (idx === -1) ? 0 : idx + 8
    result[item.fieldName] = result[item.fieldName].substr(idx)
  })
  return result
}

export async function saveAbout(token, about) {
  let octokit = new Octokit({auth: token})

  let response

  for (const idx in dataConfig.aboutLocItems) {
    // Prepend frontmatter
    about[dataConfig.aboutLocItems[idx].fieldName] = dataConfig.aboutLocItems[idx].frontMatter + about[dataConfig.aboutLocItems[idx].fieldName]

    try {
      let response = await octokit.repos.createOrUpdateFileContents({
        owner: adminConfig.githubInfo.owner,
        repo: adminConfig.githubInfo.repo,
        path: dataConfig.aboutDirName + dataConfig.aboutLocItems[idx].filePath,
        sha: about[dataConfig.aboutLocItems[idx].fieldName + '_sha'],
        content: base64.encode(utf8.encode(about[dataConfig.aboutLocItems[idx].fieldName])),
        message: 'Updated survey template'
      })
    } catch (err) {
      throw err
    }
  }
  return
}

export async function getContactFromRepo(token) {
  let octokit = new Octokit({auth: token})
  let response
  let result = {}

  try {
    response = await octokit.repos.getContent({
      owner: adminConfig.githubInfo.owner,
      repo: adminConfig.githubInfo.repo,
      path: dataConfig.contactFileName,
      headers: {'If-None-Match': ''}
    })
  } catch(err) {
    throw err
  }
  if (response !== undefined) {
    result = JSON.parse(utf8.decode(base64.decode(response.data.content)))
    result.sha = response.data.sha // Add the sha to enable update
  }
  return result
}

export async function saveContact(token, contact) {
  let octokit = new Octokit({auth: token})

  let sha = contact.sha
  delete contact.sha

  let response = await octokit.repos.createOrUpdateFileContents({
    owner: adminConfig.githubInfo.owner,
    repo: adminConfig.githubInfo.repo,
    path: dataConfig.contactFileName,
    sha: sha,
    content: base64.encode(utf8.encode(JSON.stringify(contact, null, 2))),
    message: 'Updated contact'
  })

  return response
}

export async function publishSite() {
  let response = await axios.post(dataConfig.deployHookUrl, 'publish')
  return response
}

export async function isPublishDue(token) {
  let octokit = new Octokit({auth: token})

  let response = await axios.get(dataConfig.deployDatePath)
  let deployDate = Date.parse(response.data)
  if (deployDate > 0) {
    response = await octokit.repos.get({
      owner: adminConfig.githubInfo.owner,
      repo: adminConfig.githubInfo.repo
    })

    let pushedDate = Date.parse(response.data.pushed_at)
    if (deployDate < pushedDate) {
      return true
    }
  }
  return false
}

export async function getSurveyVersions(token) {
  let response = await axios.get('/.netlify/functions/get-survey-versions?token=' + token)
  return response.data
}

export async function getSurveyData(token, version) {
  let response = await axios.get('/.netlify/functions/get-survey-data?token=' + token + '&version=' + version)
  return response.data
}
