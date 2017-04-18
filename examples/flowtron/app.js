angular.module('chatApp', ['open-chat-framework', 'auth0.lock', 'ui.router'])
    .config(function(lockProvider) {

        lockProvider.init({
          clientID: 'BiY_C0X0jFeVZ8KlxFqMKwT1xrn96xTM',
          domain: 'pubnub-ocf.auth0.com',
            options: {
              _idTokenVerification: false
            }
        });

    })
    .run(function($rootScope, lock, Me, OCF, $state) {

        // For use with UI Router
        lock.interceptHash();

        let profile = localStorage.getItem('profile');

        if(profile && profile.length) {
            
            profile = JSON.parse(profile);
            Me.profile = OCF.connect(profile.user_id, profile);

        }

        lock.on('authenticated', function(authResult) {
        
            localStorage.setItem('id_token', authResult.idToken);

            lock.getProfile(authResult.idToken, function(error, profile) {
                
                if (error) {
                    console.log(error);
                }

                localStorage.setItem('profile', JSON.stringify(profile));
            
                // connect to OCF
                Me.profile = OCF.connect(profile.user_id, profile);

                $state.go('dash')

            });
        });

    })
    .factory('Me', function() {

        return {
            profile: false
        }

    })
    .factory('OCF', function(ngOCF) {
        
        // OCF Configure
        let OCF = OpenChatFramework.create({
            rltm: {
                service: 'pubnub', 
                config: {
                    publishKey: 'pub-c-07824b7a-6637-4e6d-91b4-7f0505d3de3f',
                    subscribeKey: 'sub-c-43b48ad6-d453-11e6-bd29-0619f8945a4f',
                    restore: false
                }
            },
            globalChannel: 'ocf-demo-angular-3'
        });

        // bind open chat framework angular plugin
        ngOCF.bind(OCF);

        OCF.onAny((event, data) => {
            // console.log(event, data);
        });

        return OCF;

    })
    .config(function($stateProvider, $urlRouterProvider) {
        
        $urlRouterProvider.otherwise('/login');
        
        $stateProvider
            .state('login', {
                url: '/login',
                templateUrl: 'views/login.html',
                controller: 'LoginCtrl'
            })
            .state('dash', {
                url: '/dash',
                templateUrl: 'views/dash.html',
                controller: 'ChatAppController'
            })
            .state('dash.chat', {
                url: '/dash/:channel',
                templateUrl: 'views/chat.html',
                controller: 'Chat'
            })
    })
    .factory('Rooms', function(OCF) {

        let channels = ['Main', 'Portal', 'Blocks', 'Content', 'Support', 'Open Source', 'Client Eng', 'Docs', 'Marketing', 'Ops', 'Foolery'];

        let obj = {
            list: [],
            connect: false
        }

        obj.connect = () => {

            for(let i in channels) {
                obj.findOrCreate(channels[i])
            }

        }

        obj.find = (channel) => {

            let found = false;

            // if the chatroom is already in memory, use that one
            for(let i in obj.list) {
                if(obj.list[i].chat.channel == channel) {
                    found = obj.list[i];
                }
            }

            return found;

        }

        obj.findOrCreate = (channel) => {

            let foundRoom = obj.find(channel);

            if(foundRoom) {
                return foundRoom;
            } else {

                let chat = new OCF.Chat(channel);

                chat.plugin(OpenChatFramework.plugin.typingIndicator({
                    timeout: 5000
                }));

                chat.plugin(OpenChatFramework.plugin.history());

                chat.plugin(OpenChatFramework.plugin.unread());

                chat.plugin(OpenChatFramework.plugin.emoji());
                
                obj.list.push({
                    name: channel,
                    chat: chat,
                    messages: []
                });

                return obj.list[obj.list.length - 1];

            }

        }

        return obj;

    })
    .controller('MainCtrl', function($scope, OCF, Me) {
    })
    .controller('LoginCtrl', function($scope, lock, OCF, Me, $state) {

        $scope.lock = lock;
        $scope.Me = Me;

        if(Me.profile) {
            return $state.go('dash');
        }

    })
    .controller('OnlineUser', function($scope, OCF, Me, $state) {
  
        $scope.invite = function(user, channel) {

            // send the clicked user a private message telling them we invited them
            user.direct.send('private-invite', {channel: channel});

        }

        // create a new chat
        $scope.newChat = function(user) {

            // define a channel using the clicked user's username and this client's username
            let chan = [OCF.globalChat.channel, Me.profile.state().user_id, user.state().user_id].join(':')

            // create a new chat with that channel
            let newChat = new OCF.Chat(chan);

            $scope.invite(user, chan);

            $state.go('dash.chat', {channel: chan})

        };

    })
    .controller('ChatAppController', function($scope, $state, $stateParams, OCF, Me, Rooms) {

        Rooms.connect();

        $scope.rooms = Rooms.list;

        if(!Me.profile) {
            return  $state.go('login');
        }

        $scope.Me = Me;

        // bind chat to updates
        $scope.chat = OCF.globalChat;

        // when I get a private invite
        Me.profile.direct.on('private-invite', (payload) => {

            // create a new chat and render it in DOM
            $state.go('dash.chat', {channel: payload.data.channel});

        });

        OCF.globalChat.plugin(OpenChatFramework.plugin.onlineUserSearch());

        // hide / show usernames based on input
        $scope.userSearch = {
            input: '',
            fire: () => { 

                // get a list of our matching users
                let found = OCF.globalChat.onlineUserSearch.search($scope.userSearch.input);
                
                // hide every user
                for(let uuid in $scope.chat.users) {
                    $scope.chat.users[uuid].hideWhileSearch = true;
                }

                // show all found users
                for(let i in found) {
                    $scope.chat.users[found[i].uuid].hideWhileSearch = false;
                }

            }
        };

    })
    .controller('Chat', function($scope, $stateParams, OCF, Me, $timeout, Rooms) {

        $scope.room = Rooms.findOrCreate($stateParams.channel);

        console.log($scope.room)

        $scope.chat = $scope.room.chat;

        $scope.chat.unread.active();

        // we store the id of the lastSender
        $scope.lastSender = null;

        // leave a chatroom and remove from global chat list
        $scope.leave = (index) => {
            $scope.chat.leave();
        }

        // send a message using the messageDraft input
        $scope.sendMessage = () => {

            $scope.chat.send('message', $scope.messageDraft);
            $scope.messageDraft = '';
        }

        $scope.scrollToBottom = () => {

            $timeout(function() {
              var scroller = document.getElementById("log");
              scroller.scrollTop = scroller.scrollHeight;
            }, 0, false);

        }
        $scope.scrollToBottom();

        // function to add a message to messages array
        let addMessage = (payload, isHistory) => {

            // if this message was from a history call
            payload.isHistory = isHistory;

            // if the last message was sent from the same user
            payload.sameUser = $scope.room.messages.length > 0 && payload.sender.uuid == $scope.room.messages[$scope.room.messages.length - 1].sender.uuid;
            
            // if this message was sent by this client
            payload.isSelf = payload.sender.uuid == Me.profile.uuid;

            // add the message to the array
            $scope.room.messages.push(payload);

            $scope.scrollToBottom();

        }

        // if this chat receives a message that's not from this sessions
        let historyListener = function(payload) {

            // render it in the DOM with a special class
            addMessage(payload, true);
        };

        $scope.chat.on('$history.message', historyListener);

        // when this chat gets a message
        let messageListener = function(payload) {
            // render it in the DOM
            addMessage(payload, false);
        };

        $scope.chat.on('message', messageListener);

        $scope.$on('$destroy', function() {
            $scope.chat.unread.inactive();
            $scope.chat.off('$history.message', historyListener);
            $scope.chat.off('message', messageListener);

        });

    });
