import { Octokit } from '@octokit/rest'
import {adminConfig} from '~/utils/config'

export function getStateToken() {
  // Generate and return a UUIDv4 (from StackOverflow How to create GUID / UUID?)
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  )
}

export function getUserInfo(token) {
  let octokit = new Octokit({auth: token})

  return new Promise(function (resolve, reject) {
    octokit.users.getAuthenticated().then((profile) => {
      octokit.repos.listCollaborators({owner: adminConfig.githubInfo.owner, repo: adminConfig.githubInfo.repo}).then(() => {
        resolve({name: profile.data.name, login: profile.data.login, avatar: profile.data.avatar_url})
      }).catch((e) => {
        reject(e)
      })
    }).catch((e) => {
      reject(e)
    })
  })
}
