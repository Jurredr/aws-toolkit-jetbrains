// Copyright 2024 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

package software.aws.toolkits.jetbrains.services.codewhisperer.amazonqFeatureDev

import com.intellij.openapi.module.Module
import com.intellij.openapi.project.Project
import com.intellij.openapi.project.modules
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.testFramework.DisposableRule
import com.intellij.testFramework.replaceService
import org.gradle.internal.impldep.com.amazonaws.ResponseMetadata
import org.junit.Before
import org.junit.Rule
import org.mockito.Mockito
import org.mockito.kotlin.any
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.mock
import org.mockito.kotlin.spy
import org.mockito.kotlin.whenever
import software.amazon.awssdk.awscore.DefaultAwsResponseMetadata
import software.amazon.awssdk.http.SdkHttpResponse
import software.amazon.awssdk.services.codewhispererruntime.model.CreateTaskAssistConversationResponse
import software.aws.toolkits.core.TokenConnectionSettings
import software.aws.toolkits.core.credentials.ToolkitBearerTokenProvider
import software.aws.toolkits.core.utils.test.aString
import software.aws.toolkits.jetbrains.core.credentials.AwsBearerTokenConnection
import software.aws.toolkits.jetbrains.core.credentials.ToolkitConnectionManager
import software.aws.toolkits.jetbrains.core.credentials.sso.AccessToken
import software.aws.toolkits.jetbrains.core.credentials.sso.bearer.BearerTokenProvider
import software.aws.toolkits.jetbrains.services.amazonqFeatureDev.clients.FeatureDevClient
import software.aws.toolkits.jetbrains.services.codewhisperer.CodeWhispererTestUtil
import software.aws.toolkits.jetbrains.services.codewhisperer.service.CodeWhispererService
import software.aws.toolkits.jetbrains.utils.rules.CodeInsightTestFixtureRule
import software.aws.toolkits.jetbrains.utils.rules.HeavyJavaCodeInsightTestFixtureRule
import software.aws.toolkits.jetbrains.utils.rules.JavaCodeInsightTestFixtureRule
import software.aws.toolkits.jetbrains.utils.rules.addModule
import java.io.File
import java.time.Instant

open class FeatureDevTestBase(
    @Rule @JvmField
    val projectRule: CodeInsightTestFixtureRule = JavaCodeInsightTestFixtureRule(),

) {
    @Rule
    @JvmField
    val disposableRule = DisposableRule()

    internal lateinit var project: Project
    internal lateinit var module: Module
    internal lateinit var clientAdaptorSpy: FeatureDevClient
    internal lateinit var toolkitConnectionManager: ToolkitConnectionManager

    internal val exampleCreateTaskAssistConversationResponse = CreateTaskAssistConversationResponse.builder()
        .conversationId("1234")
        .responseMetadata(DefaultAwsResponseMetadata.create(mapOf(ResponseMetadata.AWS_REQUEST_ID to CodeWhispererTestUtil.testRequestId)))
        .sdkHttpResponse(SdkHttpResponse.builder().headers(mapOf(CodeWhispererService.KET_SESSION_ID to listOf(CodeWhispererTestUtil.testSessionId))).build())
        .build() as CreateTaskAssistConversationResponse

    @Before
    open fun setup() {
        project = projectRule.project
        toolkitConnectionManager = spy(ToolkitConnectionManager.getInstance(project))
        val accessToken = AccessToken(aString(), aString(), aString(), aString(), Instant.MAX, Instant.now())
        val provider = mock<BearerTokenProvider> {
            doReturn(accessToken).whenever(it).refresh()
        }
        val mockBearerProvider = mock<ToolkitBearerTokenProvider> {
            doReturn(provider).whenever(it).delegate
        }
        val connectionSettingsMock = mock<TokenConnectionSettings> {
            whenever(it.tokenProvider).thenReturn(mockBearerProvider)
        }
        val toolkitConnection = mock<AwsBearerTokenConnection> {
            doReturn(connectionSettingsMock).whenever(it).getConnectionSettings()
        }
        doReturn(toolkitConnection).whenever(toolkitConnectionManager).activeConnectionForFeature(any())
        project.replaceService(ToolkitConnectionManager::class.java, toolkitConnectionManager, disposableRule.disposable)
        clientAdaptorSpy = spy(FeatureDevClient.getInstance(project))
        project.replaceService(FeatureDevClient::class.java, clientAdaptorSpy, disposableRule.disposable)

        module = project.modules.firstOrNull() ?: if (projectRule is HeavyJavaCodeInsightTestFixtureRule) {
            projectRule.fixture.addModule("module1")
        } else {
            TODO()
        }

        val virtualFileMock = Mockito.mock(VirtualFile::class.java)
        doReturn("dummy/path").whenever(virtualFileMock).path
    }

    companion object {
        fun String.toResourceFile(): File {
            val uri =
                FeatureDevTestBase::class.java.getResource("/amazonqFeatureDev/$this")?.toURI()
                    ?: throw AssertionError("Unable to locate test resource $this file.")
            return File(uri)
        }
    }
}
