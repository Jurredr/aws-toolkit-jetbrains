/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ChatItem, ChatItemAction, FeedbackPayload, Engagement, NotificationType } from '@aws/mynah-ui-chat'
import { Connector as CWChatConnector } from './apps/cwChatConnector'
import { Connector as FeatureDevChatConnector } from './apps/featureDevChatConnector'
import { Connector as AmazonQCommonsConnector } from './apps/amazonqCommonsConnector'
import { ExtensionMessage } from './commands'
import { TabType, TabsStorage } from './storages/tabsStorage'
import { WelcomeFollowupType } from './apps/amazonqCommonsConnector'
import { AuthFollowUpType } from './followUps/generator'
import { CodeTransformChatConnector } from './apps/codeTransformChatConnector'
import { isFormButtonCodeTransform } from './forms/constants'
import { DiffTreeFileInfo } from './diffTree/types'

export interface CodeReference {
    licenseName?: string
    repository?: string
    url?: string
    recommendationContentSpan?: {
        start?: number
        end?: number
    }
}

export interface ChatPayload {
    chatMessage: string
    chatCommand?: string
}

export interface CWCChatItem extends ChatItem {
    userIntent?: string,
    codeBlockLanguage?: string,
}

export interface ConnectorProps {
    sendMessageToExtension: (message: ExtensionMessage) => void
    onMessageReceived?: (tabID: string, messageData: any, needToShowAPIDocsTab: boolean) => void
    onChatAnswerReceived?: (tabID: string, message: ChatItem) => void
    onCodeTransformChatDisabled: (tabID: string) => void
    onCodeTransformMessageReceived: (
        tabID: string,
        message: ChatItem,
        isLoading: boolean,
        clearPreviousItemButtons?: boolean
    ) => void
    onCodeTransformMessageUpdate: (tabID: string, messageId: string, chatItem: Partial<ChatItem>) => void
    onWelcomeFollowUpClicked: (tabID: string, welcomeFollowUpType: WelcomeFollowupType) => void
    onAsyncEventProgress: (tabID: string, inProgress: boolean, message: string | undefined) => void
    onCWCContextCommandMessage: (message: ChatItem, command?: string) => string | undefined
    onCWCOnboardingPageInteractionMessage: (message: ChatItem) => string | undefined
    onOpenSettingsMessage: (tabID: string) => void
    onError: (tabID: string, message: string, title: string) => void
    onWarning: (tabID: string, message: string, title: string) => void
    onFileComponentUpdate: (
        tabID: string,
        filePaths: DiffTreeFileInfo[],
        deletedFiles: DiffTreeFileInfo[],
        messageId: string,
        disableFileActions: boolean
    ) => void
    onUpdatePlaceholder: (tabID: string, newPlaceholder: string) => void
    onChatInputEnabled: (tabID: string, enabled: boolean) => void
    onUpdateAuthentication: (
        featureDevEnabled: boolean,
        codeTransformEnabled: boolean,
        authenticatingTabIDs: string[]
    ) => void
    onNewTab: (tabType: TabType) => void
    onStartNewTransform: (tabID: string) => void
    onCodeTransformCommandMessageReceived: (message: ChatItem, command?: string) => void
    onNotification: (props: { content: string; title?: string; type: NotificationType }) => void
    onFileActionClick: (tabID: string, messageId: string, filePath: string, actionName: string) => void
    tabsStorage: TabsStorage
}

export class Connector {
    private readonly sendMessageToExtension
    private readonly onMessageReceived
    private readonly cwChatConnector
    private readonly featureDevChatConnector
    private readonly codeTransformChatConnector: CodeTransformChatConnector
    private readonly tabsStorage
    private readonly amazonqCommonsConnector: AmazonQCommonsConnector

    private isUIReady = false

    constructor(props: ConnectorProps) {
        this.sendMessageToExtension = props.sendMessageToExtension
        this.onMessageReceived = props.onMessageReceived
        this.cwChatConnector = new CWChatConnector(props as ConnectorProps)
        this.featureDevChatConnector = new FeatureDevChatConnector(props)
        this.codeTransformChatConnector = new CodeTransformChatConnector(props)
        this.amazonqCommonsConnector = new AmazonQCommonsConnector({
            sendMessageToExtension: this.sendMessageToExtension,
            onWelcomeFollowUpClicked: props.onWelcomeFollowUpClicked,
        })
        this.tabsStorage = props.tabsStorage
    }

    onSourceLinkClick = (tabID: string, messageId: string, link: string): void => {
        switch (this.tabsStorage.getTab(tabID)?.type) {
            case 'cwc':
                this.cwChatConnector.onSourceLinkClick(tabID, messageId, link)
                break
        }
    }

    onResponseBodyLinkClick = (tabID: string, messageId: string, link: string): void => {
        switch (this.tabsStorage.getTab(tabID)?.type) {
            case 'cwc':
                this.cwChatConnector.onResponseBodyLinkClick(tabID, messageId, link)
                break
            case 'featuredev':
                this.featureDevChatConnector.onResponseBodyLinkClick(tabID, messageId, link)
                break
            case 'codetransform':
                this.codeTransformChatConnector.onResponseBodyLinkClick(tabID, messageId, link)
                break
        }
    }

    onInfoLinkClick = (tabID: string, link: string): void => {
        switch (this.tabsStorage.getTab(tabID)?.type) {
            default:
                this.cwChatConnector.onInfoLinkClick(tabID, link)
                break
        }
    }

    requestAnswer = (tabID: string, payload: ChatPayload) => {
        switch (this.tabsStorage.getTab(tabID)?.type) {
            case 'codetransform':
                return this.codeTransformChatConnector.requestAnswer(tabID, payload)
        }
    }

    requestGenerativeAIAnswer = (tabID: string, payload: ChatPayload): Promise<any> =>
        new Promise((resolve, reject) => {
            if (this.isUIReady) {
                switch (this.tabsStorage.getTab(tabID)?.type) {
                    case 'featuredev':
                        this.featureDevChatConnector.requestGenerativeAIAnswer(tabID, payload)
                        break
                    default:
                        this.cwChatConnector.requestGenerativeAIAnswer(tabID, payload)
                        break
                }
            } else {
                setTimeout(() => {
                    this.requestGenerativeAIAnswer(tabID, payload)
                }, 2000)
                return
            }
        })

    clearChat = (tabID: string): void => {
        switch (this.tabsStorage.getTab(tabID)?.type) {
            case 'cwc':
                this.cwChatConnector.clearChat(tabID)
                break
        }
    }

    help = (tabID: string): void => {
        switch (this.tabsStorage.getTab(tabID)?.type) {
            case 'cwc':
                this.cwChatConnector.help(tabID)
                break
        }
    }

    transform = (tabID: string): void => {
        switch (this.tabsStorage.getTab(tabID)?.type) {
            default:
                this.codeTransformChatConnector.transform(tabID)
                break
        }
    }

    handleMessageReceive = async (message: MessageEvent): Promise<void> => {
        if (message.data === undefined) {
            return
        }

        // TODO: potential json parsing error exists. Need to determine the failing case.
        const messageData = JSON.parse(message.data)

        if (messageData === undefined) {
            return
        }

        if (messageData.sender === 'CWChat') {
            void this.cwChatConnector.handleMessageReceive(messageData)
        } else if (messageData.sender === 'featureDevChat') {
            void this.featureDevChatConnector.handleMessageReceive(messageData)
        } else if (messageData.sender === 'codetransform') {
            void this.codeTransformChatConnector.handleMessageReceive(messageData)
        }
    }

    onTabAdd = (tabID: string): void => {
        this.tabsStorage.addTab({
            id: tabID,
            type: 'unknown',
            status: 'free',
            isSelected: true,
        })
    }

    onUpdateTabType = (tabID: string) => {
        const tab = this.tabsStorage.getTab(tabID)
        switch (tab?.type) {
            case 'cwc':
                this.cwChatConnector.onTabAdd(tabID, tab.openInteractionType)
                break
        }
    }

    onKnownTabOpen = (tabID: string): void => {
        switch (this.tabsStorage.getTab(tabID)?.type) {
            case 'featuredev':
                this.featureDevChatConnector.onTabOpen(tabID)
                break
            case 'codetransform':
                this.codeTransformChatConnector.onTabOpen(tabID)
                break
        }
    }

    onTabChange = (tabId: string): void => {
        const prevTabID = this.tabsStorage.setSelectedTab(tabId)
        this.cwChatConnector.onTabChange(tabId, prevTabID)
    }

    onCodeInsertToCursorPosition = (
        tabID: string,
        messageId: string,
        code?: string,
        type?: 'selection' | 'block',
        codeReference?: CodeReference[],
        eventId?: string,
        codeBlockIndex?: number,
        totalCodeBlocks?: number,
        userIntent?: string,
        codeBlockLanguage?: string
    ): void => {
        switch (this.tabsStorage.getTab(tabID)?.type) {
            case 'cwc':
                this.cwChatConnector.onCodeInsertToCursorPosition(
                    tabID,
                    messageId,
                    code,
                    type,
                    codeReference,
                    eventId,
                    codeBlockIndex,
                    totalCodeBlocks,
                    userIntent,
                    codeBlockLanguage
                )
                break
            case 'featuredev':
                this.featureDevChatConnector.onCodeInsertToCursorPosition(tabID, code, type, codeReference)
                break
        }
    }

    onCopyCodeToClipboard = (
        tabID: string,
        messageId: string,
        code?: string,
        type?: 'selection' | 'block',
        codeReference?: CodeReference[],
        eventId?: string,
        codeBlockIndex?: number,
        totalCodeBlocks?: number,
        userIntent?: string,
        codeBlockLanguage?: string
    ): void => {
        switch (this.tabsStorage.getTab(tabID)?.type) {
            case 'cwc':
                this.cwChatConnector.onCopyCodeToClipboard(
                    tabID,
                    messageId,
                    code,
                    type,
                    codeReference,
                    eventId,
                    codeBlockIndex,
                    totalCodeBlocks,
                    userIntent,
                    codeBlockLanguage
                )
                break
            case 'featuredev':
                this.featureDevChatConnector.onCopyCodeToClipboard(tabID, code, type, codeReference)
                break
        }
    }

    onTabRemove = (tabID: string): void => {
        const tab = this.tabsStorage.getTab(tabID)
        this.tabsStorage.deleteTab(tabID)
        switch (tab?.type) {
            case 'cwc':
                this.cwChatConnector.onTabRemove(tabID)
                break
            case 'featuredev':
                this.featureDevChatConnector.onTabRemove(tabID)
                break
            case 'codetransform':
                this.codeTransformChatConnector.onTabRemove(tabID)
                break
        }
    }

    uiReady = (): void => {
        this.isUIReady = true
        this.sendMessageToExtension({
            command: 'ui-is-ready',
        })

        if (this.onMessageReceived !== undefined) {
            window.addEventListener('message', this.handleMessageReceive.bind(this))
        }

        window.addEventListener('focus', this.handleApplicationFocus)
        window.addEventListener('blur', this.handleApplicationFocus)
    }

    handleApplicationFocus = async (event: FocusEvent): Promise<void> => {
        this.sendMessageToExtension({
            command: 'ui-focus',
            type: event.type,
            tabType: 'cwc',
        })
    }

    triggerSuggestionEngagement = (tabId: string, messageId: string, engagement: Engagement): void => {
        // let command: string = 'hoverSuggestion'
        // if (
        //     engagement.engagementType === EngagementType.INTERACTION &&
        //     engagement.selectionDistanceTraveled?.selectedText !== undefined
        // ) {
        //     command = 'selectSuggestionText'
        // }
        // this.sendMessageToExtension({
        //     command,
        //     searchId: this.searchId,
        //     suggestionId: engagement.suggestion.url,
        //     // suggestionRank: parseInt(engagement.suggestion.id),
        //     suggestionType: engagement.suggestion.type,
        //     selectedText: engagement.selectionDistanceTraveled?.selectedText,
        //     hoverDuration: engagement.engagementDurationTillTrigger / 1000, // seconds
        // })
    }

    onAuthFollowUpClicked = (tabID: string, authType: AuthFollowUpType) => {
        const tabType = this.tabsStorage.getTab(tabID)?.type
        switch (tabType) {
            case 'codetransform':
            case 'cwc':
            case 'featuredev':
                this.amazonqCommonsConnector.authFollowUpClicked(tabID, tabType, authType)
        }
    }

    onFollowUpClicked = (tabID: string, messageId: string, followUp: ChatItemAction): void => {
        switch (this.tabsStorage.getTab(tabID)?.type) {
            // TODO: We cannot rely on the tabType here,
            // It can come up at a later point depending on the future UX designs,
            // We should decide it depending on the followUp.type
            case 'unknown':
                this.amazonqCommonsConnector.followUpClicked(tabID, followUp)
                break
            case 'featuredev':
                this.featureDevChatConnector.followUpClicked(tabID, followUp)
                break
            case 'codetransform':
                this.codeTransformChatConnector.followUpClicked(tabID, followUp)
                break
            default:
                this.cwChatConnector.followUpClicked(tabID, messageId, followUp)
                break
        }
    }

    onFileActionClick = (tabID: string, messageId: string, filePath: string, actionName: string): void => {
        switch (this.tabsStorage.getTab(tabID)?.type) {
            case 'featuredev':
                this.featureDevChatConnector.onFileActionClick(tabID, messageId, filePath, actionName)
                break
        }
    }

    onOpenDiff = (tabID: string, filePath: string, deleted: boolean): void => {
        switch (this.tabsStorage.getTab(tabID)?.type) {
            case 'featuredev':
                this.featureDevChatConnector.onOpenDiff(tabID, filePath, deleted)
                break
        }
    }

    onStopChatResponse = (tabID: string): void => {
        switch (this.tabsStorage.getTab(tabID)?.type) {
            case 'featuredev':
                this.featureDevChatConnector.onStopChatResponse(tabID)
                break
            case 'cwc':
                this.cwChatConnector.onStopChatResponse(tabID)
                break
        }
    }

    sendFeedback = (tabId: string, feedbackPayload: FeedbackPayload): void | undefined => {
        switch (this.tabsStorage.getTab(tabId)?.type) {
            case 'featuredev':
                this.featureDevChatConnector.sendFeedback(tabId, feedbackPayload)
                break
            case 'cwc':
                this.cwChatConnector.onSendFeedback(tabId, feedbackPayload)
                break
        }
    }

    onChatItemVoted = (tabId: string, messageId: string, vote: 'upvote' | 'downvote'): void | undefined => {
        switch (this.tabsStorage.getTab(tabId)?.type) {
            case 'cwc':
                this.cwChatConnector.onChatItemVoted(tabId, messageId, vote)
                break
            case 'featuredev':
                this.featureDevChatConnector.onChatItemVoted(tabId, messageId, vote)
                break
        }
    }

    onFormButtonClick = (
        tabId: string,
        messageId: string,
        action: {
            id: string
            text?: string
            formItemValues?: Record<string, string>
        }
    ) => {
        if (isFormButtonCodeTransform(action.id)) {
            this.codeTransformChatConnector.onFormButtonClick(tabId, action)
        }
        switch (this.tabsStorage.getTab(tabId)?.type) {
            case 'cwc':
                if (action.id === `open-settings`) {
                    this.sendMessageToExtension({
                        command: 'open-settings',
                        type: '',
                        tabType: 'cwc',
                    })
                }
                break
        }
    }
}
